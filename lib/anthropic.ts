import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const MODEL = "claude-opus-4-7";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

type SystemBlock = { text: string; cache: boolean };

function buildSystem(blocks: SystemBlock[]): Anthropic.TextBlockParam[] {
  return blocks.map((b) => ({
    type: "text",
    text: b.text,
    ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

export async function callStructured<T extends z.ZodType>(args: {
  schema: T;
  systemBlocks: SystemBlock[];
  userPrompt: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}): Promise<{ data: z.infer<T>; usage: Anthropic.Usage }> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: args.maxTokens ?? 8000,
    system: buildSystem(args.systemBlocks),
    messages: [{ role: "user", content: args.userPrompt }],
    output_config: {
      format: zodOutputFormat(args.schema),
      effort: args.effort ?? "medium",
    },
  });

  if (!response.parsed_output) {
    const stop = response.stop_reason;
    throw new Error(
      `Claude did not return parseable structured output (stop_reason=${stop}).`,
    );
  }

  return { data: response.parsed_output as z.infer<T>, usage: response.usage };
}

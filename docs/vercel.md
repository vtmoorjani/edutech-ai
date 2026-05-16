# Vercel deploy — v0 chat log

Captured 2026-05-08. Conversation with v0 (Vercel's AI builder) during the
initial deploy of `vtmoorjani/edutech-ai` to Vercel. Hit a billing wall on
the first Anthropic API call from Vercel's runtime.

---

## Project context

- **Repo:** `vtmoorjani/edutech-ai` (cloned `main` branch into v0)
- **Deploy state at error time:** Vercel preview running, environment
  variable `ANTHROPIC_API_KEY` set, Vercel AI Gateway integration also
  connected
- **Time:** 22:39 — initial deploy. 22:47 — first error.

---

## 22:39 — Initialized project (v1)

v0 cloned `main` of `vtmoorjani/edutech-ai` and brought up the project.

## 22:47 — First error from Anthropic API

```json
AI provider error (400): 400 {
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."
  },
  "request_id": "req_011CarU27jC8fgmDQygHtvJp"
}
```

User question: *what is the issue*

### v0 response

> The error message indicates a billing issue with your Anthropic API
> account:
>
> **Problem:** Your Anthropic API credit balance is too low or depleted,
> so API requests are being rejected.
>
> **Solution:** You need to either:
>
> 1. **Add credits** — Go to your Anthropic Console at
>    console.anthropic.com and purchase more API credits
> 2. **Upgrade your plan** — Switch to a paid plan if you're on a free
>    tier
>
> This is an account-level issue with your Anthropic API key, not a code
> problem in your project. The `AI_GATEWAY_API_KEY` or Anthropic API key
> you're using has run out of credits.
>
> To fix this in your project:
>
> 1. Go to console.anthropic.com/settings/billing
> 2. Add credits or upgrade your plan
> 3. Once your account has sufficient credits, your API calls should
>    work again
>
> Would you like me to help you check which part of your codebase is
> making the Anthropic API call, or help you switch to a different AI
> provider that's available through the Vercel AI Gateway (like OpenAI
> or Google)?

## 22:47 — User: "i already paid"

### v0 response

> Great that you've added credits! The error might be due to:
>
> 1. **Cached API key** — If you generated a new API key after adding
>    credits, you'll need to update it in your project
> 2. **Propagation delay** — Sometimes it takes a few minutes for new
>    credits to be recognized
>
> _(searched AI config, checked integrations, explored 2 files)_
>
> I can see you have `ANTHROPIC_API_KEY` set and the Vercel AI Gateway
> is connected. Let me check how the API is being used:
>
> Now I understand the issue. Your project uses the Anthropic SDK
> directly with `claude-opus-4-7` model, which requires your own
> Anthropic API credits.
>
> **The problem:** Your `ANTHROPIC_API_KEY` is linked to an account
> with insufficient credits.
>
> **Options to fix this:**
>
> 1. **Update your Anthropic API key** — If you just added credits, you
>    may need to refresh the key in your project settings (click
>    Settings in the top right, then "Vars")
> 2. **Switch to Vercel AI Gateway (Recommended)** — Since you have the
>    Vercel AI Gateway connected, I can update your code to use the AI
>    SDK with the gateway instead. This uses Vercel's credits and
>    doesn't require your own Anthropic billing.
>
> Would you like me to:
>
> - **Option A:** Help you update your `ANTHROPIC_API_KEY` environment
>   variable
> - **Option B:** Migrate your code to use the Vercel AI Gateway (no
>   Anthropic billing needed)

## 22:48 — User: "i already pay claude 100 dollars a month"

### v0 response (the correct diagnosis)

> That's the issue — **Claude Pro subscription** and **Anthropic API
> credits** are two separate things:
>
> | Claude Pro ($20–100/month) | Anthropic API |
> | --- | --- |
> | For using claude.ai in browser | For programmatic API access |
> | Paid at claude.ai | Paid at console.anthropic.com |
> | Does NOT include API credits | Requires separate billing |
>
> Your monthly subscription gives you access to Claude in the browser,
> but your code needs API credits from a different billing system.
>
> **Easiest fix:** Let me switch your project to use the Vercel AI
> Gateway, which is already connected to your project. This routes
> through Vercel's infrastructure and you won't need separate Anthropic
> API billing.
>
> Want me to update your code to use the Vercel AI Gateway instead?
> It's a quick change and will work immediately.

---

## Resolution status

**Pending user decision.** Two paths:

### Option A — Top up Anthropic API credits (keep current code as-is)

1. Go to <https://console.anthropic.com/settings/billing> (note: this is
   the *API* billing page, separate from the claude.ai subscription
   billing)
2. Add credits (recommend ≥ $10 for MVP — each end-to-end run costs
   roughly $0.05–$0.20 with prompt caching warm)
3. Wait ~1–2 minutes for propagation
4. Re-trigger the failing call. No code change needed.

**Trade-offs:** Cleanest. No code change. You see Anthropic's usage
dashboard directly. Costs hit you directly.

### Option B — Migrate to the Vercel AI Gateway

Vercel routes the Anthropic call through their gateway, billing usage
to your Vercel plan instead of your Anthropic account. v0 offered to do
this migration in-place.

**Trade-offs:** No second billing relationship. But: code changes from
the official Anthropic SDK to the Vercel `ai`/`@ai-sdk/anthropic`
package, which means the `messages.parse()` + Zod structured-output
helper used in `lib/anthropic.ts` would need to be re-implemented (the
Vercel AI SDK uses `generateObject` for structured outputs, different
shape). Prompt caching support in the Vercel AI SDK has historically
been less explicit than in the official Anthropic SDK — would need
verification.

---

## What this build did right (no action needed)

The Anthropic SDK's typed exception path correctly surfaced the billing
error as a `400 invalid_request_error` and the route handler in
`app/api/skill-gap/route.ts` (and the others) propagated the upstream
status (`502`) and message back to the UI. The application logic and
auth/middleware path all worked — only the API call itself was
rejected by Anthropic for billing reasons.

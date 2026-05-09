import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-6 py-6 flex items-center justify-between">
        <div className="font-semibold tracking-tight">SkillPath AI</div>
        <nav className="text-sm text-zinc-500">
          <span className="rounded-full border border-zinc-200 px-3 py-1 dark:border-zinc-800">
            MVP — AI Product Manager track
          </span>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-3xl px-6 pt-12 pb-8 sm:pt-20">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Stop guessing which course to take next.
        </h1>
        <p className="mt-6 text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          SkillPath AI maps your current skills against your target role,
          recommends the right courses across Coursera, Maven, Edureka, Udemy,
          and LinkedIn Learning, and turns them into a phased roadmap you can
          actually finish.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/intake"
            className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Start your assessment
          </Link>
          <a
            href="#how"
            className="inline-flex h-12 items-center rounded-full border border-zinc-200 px-6 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            How it works
          </a>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          ~5 minutes. No login required to see your skill gap and recommendations.
        </p>
      </section>

      <section
        id="how"
        className="mx-auto w-full max-w-5xl px-6 py-16 grid gap-6 sm:grid-cols-3"
      >
        {[
          {
            n: "1",
            t: "Tell us your goal",
            d: "Current role, target role, weekly hours, budget, and how you like to learn.",
          },
          {
            n: "2",
            t: "See your skill gap",
            d: "Plain-language analysis of what you already have and what to build next.",
          },
          {
            n: "3",
            t: "Get a roadmap",
            d: "Ranked courses with reasoning, plus a phased plan you can save or export.",
          },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-sm text-zinc-500">Step {s.n}</div>
            <div className="mt-2 font-medium">{s.t}</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {s.d}
            </p>
          </div>
        ))}
      </section>

      <footer className="mx-auto w-full max-w-5xl px-6 py-10 text-xs text-zinc-500">
        Recommendations are AI-generated from a curated catalog. Always cross-
        check against the course provider before purchasing.
      </footer>
    </main>
  );
}

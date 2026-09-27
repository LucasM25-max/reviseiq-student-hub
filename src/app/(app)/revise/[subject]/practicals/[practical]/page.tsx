import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/content/markdown";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getPracticalByNumber } from "@/lib/content/queries";

type Params = Promise<{ subject: string; practical: string }>;

/** "rp-1" → 1. Anything else is a 404 rather than a coerced NaN lookup. */
function practicalNumber(slug: string): number | null {
  const match = /^rp-(\d{1,2})$/.exec(slug);
  if (!match) return null;
  const parsed = Number.parseInt(match[1]!, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, practical: slug } = await params;
  const number = practicalNumber(slug);
  const practical = number === null ? null : await getPracticalByNumber(subject, number);
  return {
    title: practical
      ? `Required practical ${practical.number}: ${practical.title}`
      : "Required practical",
    robots: { index: false, follow: false },
  };
}

export default async function PracticalPage({ params }: { params: Params }) {
  await requireOnboardedUser();

  const { subject, practical: slug } = await params;
  const number = practicalNumber(slug);
  if (number === null) notFound();

  const practical = await getPracticalByNumber(subject, number);
  if (!practical) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/revise" className="hover:text-foreground">
          Revise
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Required practicals</span>
      </nav>

      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Required practical {practical.number}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {practical.title}
        </h1>
        <p className="mt-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <span className="font-semibold">The requirement: </span>
          {practical.requirement}
        </p>
        {practical.coverage === "PARTIAL" ? (
          // The declared gap is shown to the student, not just to the coverage report.
          // Telling them what is *not* covered is part of being honest about progress.
          <p className="mt-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] px-4 py-3 text-sm">
            <span className="font-semibold">Partly covered so far. </span>
            {practical.blockedBy.join(" ")}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="aim">
        <h2 id="aim" className="mb-2 text-xl font-semibold tracking-tight">
          Aim
        </h2>
        <p className="leading-7">{practical.aim}</p>
      </section>

      <section aria-labelledby="apparatus">
        <h2 id="apparatus" className="mb-2 text-xl font-semibold tracking-tight">
          Apparatus
        </h2>
        <ul className="list-disc space-y-1 pl-6 leading-7">
          {practical.apparatus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="method">
        <h2 id="method" className="mb-2 text-xl font-semibold tracking-tight">
          Method
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          The reason beside each step is what the exam asks about — not whether you did it.
        </p>
        <ol className="space-y-3">
          {practical.method.map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-xs font-semibold text-[var(--secondary-foreground)]">
                {step.n}
              </span>
              <div>
                <p className="leading-7">{step.text}</p>
                {step.why ? (
                  <p className="mt-0.5 text-sm text-muted-foreground italic">{step.why}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="errors">
        <h2 id="errors" className="mb-2 text-xl font-semibold tracking-tight">
          Sources of error
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Every row here is a real way the practical goes wrong, what you would see, and the
          reason the correct technique exists.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                  What goes wrong
                </th>
                <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                  What you see
                </th>
                <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                  Why the correct technique exists
                </th>
              </tr>
            </thead>
            <tbody>
              {practical.faults.map((fault) => (
                <tr key={fault.id}>
                  <td className="border border-border px-3 py-2 align-top">
                    {fault.trigger}
                    {fault.fatal ? (
                      <span className="mt-1 block text-xs font-semibold text-[var(--destructive)]">
                        Ends the experiment
                      </span>
                    ) : null}
                  </td>
                  <td className="border border-border px-3 py-2 align-top">{fault.effect}</td>
                  <td className="border border-border px-3 py-2 align-top">{fault.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="safety">
        <h2 id="safety" className="mb-2 text-xl font-semibold tracking-tight">
          Safety
        </h2>
        <ul className="list-disc space-y-1 pl-6 leading-7">
          {practical.safety.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="skills">
        <h2 id="skills" className="mb-2 text-xl font-semibold tracking-tight">
          Skills assessed
        </h2>
        <Markdown>
          {`This practical assesses **${practical.atSkills.join("** and **")}**. AT 1 is measuring length accurately; AT 7 is using a microscope and producing labelled scientific drawings.`}
        </Markdown>
      </section>
    </div>
  );
}

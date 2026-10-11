import type { Metadata } from "next";
import Link from "next/link";

import { PeriodForm } from "@/components/settings/calendar-forms";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deletePeriodFormAction, seedCalendarFormAction } from "@/lib/today/calendar-actions";
import { periodFor } from "@/lib/today/calendar";

export const metadata: Metadata = {
  title: "Your school year",
  robots: { index: false, follow: false },
};

const KIND_LABEL: Record<string, string> = {
  TERM: "Term",
  HALF_TERM: "Half term",
  HOLIDAY: "Holiday",
  STUDY_LEAVE: "Study leave",
  EXAM_SEASON: "Exam season",
};

const asDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The school calendar (D24).
 *
 * Seeded with England's usual shape and fully editable, because term dates vary by
 * a fortnight between counties — a wrong holiday silently changes how much work
 * someone is handed on a school night.
 */
export default async function CalendarPage() {
  const user = await requireOnboardedUser();

  const periods = await prisma.termPeriod.findMany({
    where: { userId: user.id },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      kind: true,
      startDate: true,
      endDate: true,
      minutesPerDay: true,
      label: true,
    },
  });

  const now = new Date();
  const current = periodFor(now, periods);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Your school year
          </h1>
          <p className="mt-1 text-muted-foreground">
            Term dates change how much Today asks of you. Holidays get your holiday goal; study
            leave reshapes the plan around the next paper.
          </p>
        </div>
        <Link href="/settings" className="rounded text-sm underline hover:no-underline">
          Back to settings
        </Link>
      </header>

      {current ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-sm">
          Right now you&rsquo;re in <strong>{current.label ?? KIND_LABEL[current.kind]}</strong>
          , until{" "}
          {current.endDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
          .
        </p>
      ) : null}

      {periods.length === 0 ? (
        <section className="rounded-lg border border-[var(--border)] p-6">
          <h2 className="text-lg font-medium">No calendar yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We can lay down the usual English term dates for you to correct — faster than typing
            twelve of them.
          </p>
          <form action={seedCalendarFormAction} className="mt-4">
            <SubmitButton size="sm" pendingLabel="Adding…">
              Use the usual English dates
            </SubmitButton>
          </form>
        </section>
      ) : (
        <section aria-labelledby="periods">
          <h2 id="periods" className="mb-3 text-lg font-semibold">
            This year
          </h2>
          <ul className="space-y-2">
            {periods.map((period) => (
              <li
                key={period.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {period.label ?? KIND_LABEL[period.kind] ?? period.kind}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {KIND_LABEL[period.kind] ?? period.kind}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {period.startDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}{" "}
                    –{" "}
                    {period.endDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                    {period.minutesPerDay ? ` · ${period.minutesPerDay} min a day` : ""}
                  </p>
                </div>
                <form action={deletePeriodFormAction}>
                  <input type="hidden" name="periodId" value={period.id} />
                  <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…">
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="add"
        className="rounded-lg border border-[var(--border)] p-4 sm:p-5"
      >
        <h2 id="add" className="mb-3 text-lg font-semibold">
          Add a period
        </h2>

        <PeriodForm label="Add period">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="period-kind" className="block text-sm font-medium">
                Kind
              </label>
              <select
                id="period-kind"
                name="kind"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              >
                {Object.entries(KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="period-label" className="block text-sm font-medium">
                Name it (optional)
              </label>
              <input
                id="period-label"
                name="label"
                maxLength={60}
                placeholder="Easter"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="period-start" className="block text-sm font-medium">
                From
              </label>
              <input
                id="period-start"
                name="startDate"
                type="date"
                required
                defaultValue={asDate(now)}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="period-end" className="block text-sm font-medium">
                To
              </label>
              <input
                id="period-end"
                name="endDate"
                type="date"
                required
                defaultValue={asDate(now)}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="period-minutes" className="block text-sm font-medium">
                Minutes a day here (optional)
              </label>
              <input
                id="period-minutes"
                name="minutesPerDay"
                type="number"
                min={5}
                max={600}
                step={5}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </PeriodForm>
      </section>
    </div>
  );
}

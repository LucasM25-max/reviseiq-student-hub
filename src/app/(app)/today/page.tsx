import type { Metadata } from "next";
import Link from "next/link";

import { QuickSessionForm, TaskActions } from "@/components/today/plan-view";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedUser } from "@/lib/auth/session";
import { regeneratePlanFormAction } from "@/lib/today/actions";
import { ensurePlanFor } from "@/lib/today/materialise";

export const metadata: Metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};

const TYPE_LABEL: Record<string, string> = {
  FLASHCARDS: "Flashcards",
  LESSON: "Lesson",
  NOTES: "Notes",
  BLURT: "Blurt",
  QUESTIONS: "Questions",
  DIAGNOSTIC: "Check-in",
  PRACTICAL: "Required practical",
  RAG_REFINE: "Rate your topics",
  MINI_MOCK: "Mini mock",
  FULL_MOCK: "Full paper",
};

const MODE_LABEL: Record<string, string> = {
  KEEPING_PACE: "Keeping pace with school",
  LEARNING_HEAVY: "Learning the content",
  BALANCED: "Building up",
  EXAM_FOCUS: "Exam focus",
  STUDY_LEAVE: "Study leave",
  FINAL_SPRINT: "Final stretch",
};

export default async function TodayPage() {
  const user = await requireOnboardedUser();

  const now = new Date();
  const plan = await ensurePlanFor(user.id, now);
  const startedAt = now.toISOString();

  if (!plan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Today</h1>
        <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-muted-foreground">
          Pick your subjects and we&rsquo;ll start building your plan.{" "}
          <Link href="/settings/subjects" className="underline hover:no-underline">
            Choose subjects
          </Link>
          .
        </p>
      </div>
    );
  }

  const pending = plan.tasks.filter((task) => task.status === "PENDING");
  const done = plan.tasks.filter((task) => task.status === "DONE");
  const live = [...done, ...pending].filter((task) => task.status !== "SWAPPED");

  const totalMinutes = live.reduce((sum, task) => sum + task.estMinutes, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Today</h1>
          <p className="mt-1 text-muted-foreground">
            {plan.suppressedReason
              ? (MODE_LABEL[plan.mode] ?? "")
              : `${MODE_LABEL[plan.mode] ?? plan.mode} · about ${totalMinutes} minutes`}
          </p>
        </div>
        {done.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {done.length} of {live.length} done
          </p>
        ) : null}
      </header>

      {plan.suppressedReason === "EXAM_TODAY" ? (
        <section className="rounded-lg border border-[var(--border)] p-6">
          <h2 className="text-lg font-medium">Good luck today</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing scheduled — go and sit it. Everything here will still be here afterwards.
          </p>
        </section>
      ) : plan.suppressedReason === "SCHEDULING_OFF" ? (
        <section className="rounded-lg border border-[var(--border)] p-6">
          <h2 className="text-lg font-medium">That&rsquo;s your exams done</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We&rsquo;ve stopped planning. Everything stays browsable, and if you have a resit,
            add the date in settings and plans start again.
          </p>
        </section>
      ) : live.length === 0 ? (
        <section className="rounded-lg border border-[var(--border)] p-6">
          <h2 className="text-lg font-medium">Nothing left for today</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            That&rsquo;s the lot. Tomorrow&rsquo;s plan builds overnight.
          </p>
        </section>
      ) : (
        <ol className="space-y-3">
          {live.map((task, index) => (
            <li
              key={task.id}
              className={`rounded-lg border border-[var(--border)] p-4 ${
                task.status === "DONE" ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    {index + 1}. {TYPE_LABEL[task.type] ?? task.type} · {task.estMinutes} min
                  </p>
                  <p className="mt-1 font-medium">{task.title}</p>
                  {/* Trust in the plan is downstream of understanding why (doc 05 §9). */}
                  <p className="mt-1 text-sm text-muted-foreground">{task.rationale}</p>
                </div>

                <TaskActions
                  taskId={task.id}
                  href={task.targetHref}
                  done={task.status === "DONE"}
                  startedAt={startedAt}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {plan.gateMessage ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-sm">
          {plan.gateMessage}
        </p>
      ) : null}

      {!plan.suppressedReason ? (
        <section className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border)] pt-6">
          <QuickSessionForm current={plan.targetMinutes} />
          <form action={regeneratePlanFormAction}>
            <SubmitButton size="sm" variant="ghost" pendingLabel="Rebuilding…">
              Build a fresh plan
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import { BookOpen, Clock, FileQuestion, Flame, Layers } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RAG_CLASSES, RAG_META, RAG_ORDER, subjectClasses } from "@/lib/rag";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getTodaySummary } from "@/lib/today/stub-plan";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};

const KIND_ICONS = {
  LEARN: BookOpen,
  REVISE: Layers,
  TEST: FileQuestion,
} as const;

export default async function TodayPage() {
  const user = await requireOnboardedUser();
  const summary = await getTodaySummary(user.id);

  const firstName = user.name?.split(" ")[0];
  const plannedMinutes = summary.tasks.reduce((sum, task) => sum + task.minutes, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {summary.greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {summary.minutesAvailableToday > 0
              ? `You said you've got about ${summary.minutesAvailableToday} minutes today.`
              : "You've got nothing scheduled today — enjoy it."}
          </p>
        </div>

        <div className="flex gap-2">
          <Stat
            icon={<Flame className="size-4 text-warning" aria-hidden="true" />}
            value={summary.streakCurrent}
            label={summary.streakCurrent === 1 ? "day streak" : "day streak"}
          />
          <Stat
            icon={<Clock className="size-4 text-muted-foreground" aria-hidden="true" />}
            value={summary.dailyGoalMinutes}
            label="min goal"
          />
          {summary.nextExamInDays !== null ? (
            <Stat value={summary.nextExamInDays} label="days to paper 1" />
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Your plan for today</CardTitle>
            <CardDescription>
              Built from your ratings, your exam dates and the time you said you have.
            </CardDescription>
          </div>
          {plannedMinutes > 0 ? (
            <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
              ~{plannedMinutes} min
            </span>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">This is a preview, not a real plan</p>
            <p className="mt-0.5 text-muted-foreground">
              The scheduler arrives in Phase 7, once there are lessons, notes and questions for
              it to schedule. These tasks come from your real ratings, but nothing behind them
              is built yet.
            </p>
          </div>

          {summary.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to show yet — add a subject and rate some topics.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {summary.tasks.map((task) => {
                const Icon = KIND_ICONS[task.kind];
                const accent = subjectClasses(task.accent);

                return (
                  <li key={task.id} className="flex items-center gap-3 bg-card px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                        accent.surface,
                        accent.text,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {task.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {task.subject} · {task.detail}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {task.minutes} min
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground sm:inline">
                      {task.availableIn}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="where-you-are">
        <h2 id="where-you-are" className="mb-3 text-lg font-semibold tracking-tight">
          Where you are
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.subjects.map((subject) => {
            const accent = subjectClasses(subject.accent);

            return (
              <Card key={subject.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <CardTitle className={cn("text-base", accent.text)}>
                      {subject.name}
                    </CardTitle>
                    {subject.firstPaperInDays !== null && subject.firstPaperInDays >= 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {subject.firstPaperInDays} days
                      </span>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div
                    className="flex h-2 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={RAG_ORDER.map(
                      (value) => `${subject.counts[value]} ${RAG_META[value].label}`,
                    ).join(", ")}
                  >
                    {RAG_ORDER.map((value) =>
                      subject.counts[value] > 0 ? (
                        <span
                          key={value}
                          className={RAG_CLASSES[value].dot}
                          style={{ width: `${(subject.counts[value] / subject.total) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </div>

                  <ul className="grid grid-cols-2 gap-1 text-xs">
                    {RAG_ORDER.map((value) => (
                      <li
                        key={value}
                        className="flex items-center gap-1.5 text-muted-foreground"
                      >
                        <span
                          aria-hidden="true"
                          className={cn("size-1.5 rounded-full", RAG_CLASSES[value].dot)}
                        />
                        <span className="text-foreground tabular-nums">
                          {subject.counts[value]}
                        </span>
                        {RAG_META[value].label}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Changed your mind about any of these?{" "}
          <Link href="/settings" className="rounded font-medium text-primary hover:underline">
            Update your ratings
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon?: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
      <p className="flex items-center justify-center gap-1.5 text-lg leading-none font-semibold text-foreground tabular-nums">
        {icon}
        {value}
      </p>
      <p className="mt-1 text-[0.6875rem] text-muted-foreground">{label}</p>
    </div>
  );
}

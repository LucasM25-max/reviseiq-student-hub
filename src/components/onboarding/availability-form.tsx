"use client";

import { useActionState, useState } from "react";

import type { ReminderChannel } from "@/generated/prisma/enums";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldHint } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { saveAvailabilityAction } from "@/lib/onboarding/actions";
import { cn } from "@/lib/utils";

/** Monday-first, mapped to JavaScript's Sunday-is-0 weekday numbering. */
const WEEK = [
  { weekday: 1, label: "Monday", short: "Mon", schoolNight: true },
  { weekday: 2, label: "Tuesday", short: "Tue", schoolNight: true },
  { weekday: 3, label: "Wednesday", short: "Wed", schoolNight: true },
  { weekday: 4, label: "Thursday", short: "Thu", schoolNight: true },
  { weekday: 5, label: "Friday", short: "Fri", schoolNight: false },
  { weekday: 6, label: "Saturday", short: "Sat", schoolNight: false },
  { weekday: 0, label: "Sunday", short: "Sun", schoolNight: false },
] as const;

const DEFAULTS: Record<number, number> = { 1: 30, 2: 30, 3: 30, 4: 30, 5: 0, 6: 60, 0: 45 };

const PRESETS = [
  { label: "School nights", minutes: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 0, 6: 45, 0: 45 } },
  { label: "Weekends only", minutes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 90, 0: 90 } },
  {
    label: "Half an hour, daily",
    minutes: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 30, 0: 30 },
  },
] as const;

const GOALS = [15, 20, 30, 45, 60, 90];

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "None";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest}`;
}

export function AvailabilityForm({
  initialMinutes,
  dailyGoal,
  holidayGoal,
  reminderChannel,
  reminderTime,
  returnTo,
  submitLabel = "Finish setup",
}: {
  initialMinutes: Record<number, number | undefined>;
  dailyGoal: number;
  holidayGoal: number;
  reminderChannel: ReminderChannel;
  reminderTime: string;
  returnTo?: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(saveAvailabilityAction, idleFormState);
  const [remindByEmail, setRemindByEmail] = useState(reminderChannel === "EMAIL");

  const [minutes, setMinutes] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      WEEK.map(({ weekday }) => [weekday, initialMinutes[weekday] ?? DEFAULTS[weekday]]),
    ),
  );

  const weeklyTotal = Object.values(minutes).reduce((sum, value) => sum + value, 0);

  return (
    <form action={action} className="space-y-6">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {state.message ? <Alert variant="error">{state.message}</Alert> : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>A typical week</CardTitle>
            <CardDescription>Drag to set how long you have on each day.</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {(weeklyTotal / 60).toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">hours a week</p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => setMinutes({ ...preset.minutes })}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            {WEEK.map((day) => (
              <div key={day.weekday} className="flex items-center gap-3 py-1">
                <label
                  htmlFor={`minutes-${day.weekday}`}
                  className="w-10 shrink-0 text-sm font-medium text-foreground sm:w-20"
                >
                  <span className="sm:hidden">{day.short}</span>
                  <span className="hidden sm:inline">{day.label}</span>
                </label>

                <input
                  id={`minutes-${day.weekday}`}
                  name={`minutes:${day.weekday}`}
                  type="range"
                  min={0}
                  max={240}
                  step={15}
                  value={minutes[day.weekday]}
                  onChange={(event) =>
                    setMinutes((previous) => ({
                      ...previous,
                      [day.weekday]: Number(event.target.value),
                    }))
                  }
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  aria-describedby={`minutes-value-${day.weekday}`}
                />

                <span
                  id={`minutes-value-${day.weekday}`}
                  className={cn(
                    "w-16 shrink-0 text-right text-sm tabular-nums",
                    minutes[day.weekday] === 0
                      ? "text-muted-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {formatMinutes(minutes[day.weekday])}
                </span>
              </div>
            ))}
          </div>

          <FieldHint>
            This is your ceiling, not a target. Today will use as much of it as you have work
            for, and you can always say &ldquo;I&apos;ve only got 25 minutes&rdquo; on the day.
          </FieldHint>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily goal</CardTitle>
          <CardDescription>
            What counts as a day done — this is what keeps your streak alive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <GoalPicker
            name="dailyGoalMinutes"
            legend="During term time"
            defaultValue={dailyGoal}
          />
          <GoalPicker
            name="holidayGoalMinutes"
            legend="During the holidays"
            defaultValue={holidayGoal}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>
            One short nudge, at a time you choose. Off by default — turn it on only if it would
            actually help.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset>
            <legend className="sr-only">Reminder method</legend>
            <div className="flex flex-wrap gap-2">
              <label
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors",
                  "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:font-medium has-[:checked]:text-foreground",
                )}
              >
                <input
                  type="radio"
                  name="reminderChannel"
                  value="NONE"
                  defaultChecked={reminderChannel !== "EMAIL"}
                  onChange={() => setRemindByEmail(false)}
                  className="sr-only"
                />
                No reminders
              </label>
              <label
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors",
                  "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:font-medium has-[:checked]:text-foreground",
                )}
              >
                <input
                  type="radio"
                  name="reminderChannel"
                  value="EMAIL"
                  defaultChecked={reminderChannel === "EMAIL"}
                  onChange={() => setRemindByEmail(true)}
                  className="sr-only"
                />
                Email me
              </label>
            </div>
          </fieldset>

          {remindByEmail ? (
            <div className="flex items-center gap-3">
              <label htmlFor="reminderTime" className="text-sm font-medium text-foreground">
                At
              </label>
              <input
                id="reminderTime"
                name="reminderTime"
                type="time"
                defaultValue={reminderTime}
                className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground"
              />
              <FieldHint>Your local time. Change or stop it any time.</FieldHint>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

function GoalPicker({
  name,
  legend,
  defaultValue,
}: {
  name: string;
  legend: string;
  defaultValue: number;
}) {
  const options = GOALS.includes(defaultValue)
    ? GOALS
    : [...GOALS, defaultValue].sort((a, b) => a - b);

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((value) => (
          <label
            key={value}
            className={cn(
              "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors",
              "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
              "has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:font-medium has-[:checked]:text-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={value === defaultValue}
              className="sr-only"
            />
            {value} min
          </label>
        ))}
      </div>
    </fieldset>
  );
}

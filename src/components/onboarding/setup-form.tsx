"use client";

import { useActionState, useState } from "react";

import type { TierChoice, YearGroup } from "@/generated/prisma/enums";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { saveSetupAction } from "@/lib/onboarding/actions";
import { subjectClasses } from "@/lib/rag";
import { cn } from "@/lib/utils";

type SubjectRow = {
  subjectId: string;
  name: string;
  accent: string;
  tier: TierChoice;
};

type PreviewYear = {
  year: number;
  papers: { label: string; iso: string }[];
};

const YEAR_GROUPS: { value: YearGroup; label: string; blurb: string }[] = [
  { value: "YEAR_10", label: "Year 10", blurb: "Exams next year — building up." },
  { value: "YEAR_11", label: "Year 11", blurb: "Exams this year." },
  { value: "OTHER", label: "Something else", blurb: "Resitting, home-educated, other." },
];

const TIERS: { value: TierChoice; label: string; blurb: string }[] = [
  { value: "FOUNDATION", label: "Foundation", blurb: "Grades 1–5" },
  { value: "HIGHER", label: "Higher", blurb: "Grades 4–9" },
  { value: "UNSURE", label: "Not sure yet", blurb: "We'll assume Higher" },
];

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function SetupForm({
  yearGroup,
  years,
  defaultYear,
  subjects,
  previewDates,
  returnTo,
  submitLabel = "Continue",
}: {
  yearGroup: YearGroup;
  years: number[];
  defaultYear: number;
  subjects: SubjectRow[];
  previewDates: PreviewYear[];
  returnTo?: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(saveSetupAction, idleFormState);
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const preview = previewDates.find((entry) => entry.year === selectedYear);

  return (
    <form action={action} className="space-y-6">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {state.message ? <Alert variant="error">{state.message}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>What year are you in?</CardTitle>
          <CardDescription>
            Year 10 gets a keeping-pace plan; Year 11 gets a countdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">Year group</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {YEAR_GROUPS.map((option) => (
                <OptionTile
                  key={option.value}
                  name="yearGroup"
                  value={option.value}
                  label={option.label}
                  blurb={option.blurb}
                  defaultChecked={option.value === yearGroup}
                />
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Which tier are you sitting?</CardTitle>
          <CardDescription>
            It changes which content and questions you get. Ask your teacher if you don&apos;t
            know — &ldquo;not sure&rdquo; is a perfectly good answer for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {subjects.map((subject) => {
            const accent = subjectClasses(subject.accent);
            return (
              <fieldset key={subject.subjectId}>
                <legend className={cn("mb-2 text-sm font-semibold", accent.text)}>
                  {subject.name}
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TIERS.map((tier) => (
                    <OptionTile
                      key={tier.value}
                      name={`tier:${subject.subjectId}`}
                      value={tier.value}
                      label={tier.label}
                      blurb={tier.blurb}
                      defaultChecked={tier.value === subject.tier}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When do you sit them?</CardTitle>
          <CardDescription>
            We&apos;ll start from the usual AQA timetable. Put the exact dates in from Settings
            once school gives you the real thing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset>
            <legend className="sr-only">Exam series</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {years.map((year) => (
                <OptionTile
                  key={year}
                  name="examYear"
                  value={String(year)}
                  label={`Summer ${year}`}
                  blurb={year === years[0] ? "The next series" : "The one after"}
                  defaultChecked={year === defaultYear}
                  onSelect={() => setSelectedYear(year)}
                />
              ))}
            </div>
          </fieldset>

          {preview ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium text-foreground">
                Estimated dates — we&apos;ll mark these as unconfirmed
              </p>
              <ul className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                {preview.papers.map((paper) => (
                  <li key={paper.label} className="flex justify-between gap-3">
                    <span>{paper.label}</span>
                    <span className="font-mono tabular-nums">
                      {dateFormat.format(new Date(paper.iso))}
                    </span>
                  </li>
                ))}
              </ul>
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

function OptionTile({
  name,
  value,
  label,
  blurb,
  defaultChecked,
  onSelect,
}: {
  name: string;
  value: string;
  label: string;
  blurb: string;
  defaultChecked?: boolean;
  onSelect?: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-lg border bg-card p-3 transition-colors",
        "border-border hover:border-muted-foreground/40",
        "has-[:checked]:border-primary has-[:checked]:bg-primary/5",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{blurb}</span>
    </label>
  );
}

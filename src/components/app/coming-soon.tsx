import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * An honest placeholder.
 *
 * Phases 0–2 build the account, the shell and everything the planner needs to know about
 * a student. Learn, Revise and Test are real pages with nothing in them yet, and saying
 * so plainly beats a spinner or a fake empty state.
 */
export function ComingSoon({
  phase,
  title,
  summary,
  bullets,
}: {
  phase: string;
  title: string;
  summary: string;
  bullets: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {phase}
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{summary}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-2 size-1 shrink-0 rounded-full bg-border"
              />
              {bullet}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

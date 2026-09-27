import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { requireOnboardedUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Test",
  robots: { index: false, follow: false },
};

export default async function TestPage() {
  await requireOnboardedUser();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Test</h1>
        <p className="mt-1 text-muted-foreground">
          Exam questions on every topic, and full papers under timed conditions.
        </p>
      </header>

      <ComingSoon
        phase="Phase 5"
        title="Questions and marking"
        summary="Original AQA-style questions with real mark schemes. Every written answer is marked against the mark scheme point by point, with the reasoning shown."
        bullets={[
          "Multiple choice, structured, short answer and extended response — the same mix as the real papers",
          "Written answers marked by AI against the mark scheme, with a breakdown per mark point",
          "Mini-mocks scoped to what you've covered, plus full timed papers",
          "Dispute a mark you think is wrong, and it goes to a human",
        ]}
      />
    </div>
  );
}

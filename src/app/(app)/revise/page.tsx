import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { requireOnboardedUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Revise",
  robots: { index: false, follow: false },
};

export default async function RevisePage() {
  await requireOnboardedUser();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Revise</h1>
        <p className="mt-1 text-muted-foreground">
          Short notes, flashcards and the other things that make revision stick.
        </p>
      </header>

      <ComingSoon
        phase="Phase 6"
        title="Revision aids come after the questions"
        summary="Flashcards here are made from questions you actually got wrong — so Test has to work first. That is a deliberate ordering, not an oversight."
        bullets={[
          "Condensed notes per sub-topic, written to be re-read rather than read once",
          "Flashcards generated from your wrong answers, scheduled with FSRS-6",
          "A formula sheet and required-practical sheets per subject",
          "Semi-blurting prompts for when you want to check what's actually in your head",
        ]}
      />
    </div>
  );
}

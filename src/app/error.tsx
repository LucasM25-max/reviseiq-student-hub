"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/logo";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry is wired up in Phase 11; until then the server log is the record.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-4 sm:px-8">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something broke</h1>
        <p className="mt-2 text-muted-foreground">
          That&apos;s on us, not you. Nothing you&apos;d saved has been lost.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>Try again</Button>
        </div>
      </main>
    </div>
  );
}

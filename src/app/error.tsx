"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/logo";

/**
 * A failed `fetch` rejects with a TypeError whose message is browser-specific
 * ("Failed to fetch", "NetworkError when attempting to fetch resource",
 * "Load failed"). It means the request never reached the server at all.
 */
function isConnectionFailure(error: Error): boolean {
  return (
    error.name === "TypeError" && /fetch|network|load failed|connection/i.test(error.message)
  );
}

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

  // Losing the connection is not the same as the app being broken, and saying
  // "that's on us" when someone's wifi dropped sends them looking in the wrong place.
  const offline = isConnectionFailure(error);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-4 sm:px-8">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {offline ? "We couldn't reach ReviseIQ" : "Something broke"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {offline
            ? "The connection dropped before that could finish. Check you're online, then try again — anything already saved is safe."
            : "That's on us, not you. Nothing you'd saved has been lost."}
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
        {/*
          When the connection is what failed, `reset()` only re-renders the same tree
          against the same unreachable server — and if the page went stale against a
          newer deploy, it can never succeed. A full reload fetches the page again and
          recovers from both, so it leads. Retrying in place stays available for the
          case where it really was a blip.
        */}
        <div className="mt-6 flex justify-center gap-3">
          {offline ? (
            <>
              <Button onClick={() => window.location.reload()}>Reload the page</Button>
              <Button variant="secondary" onClick={reset}>
                Try again
              </Button>
            </>
          ) : (
            <Button onClick={reset}>Try again</Button>
          )}
        </div>
      </main>
    </div>
  );
}

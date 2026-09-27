import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-4 sm:px-8">
        <Link href="/" className="rounded-md" aria-label="ReviseIQ home">
          <Wordmark />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          There&apos;s nothing here
        </h1>
        <p className="mt-2 text-muted-foreground">
          The page you were after doesn&apos;t exist, or it hasn&apos;t been built yet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/today" className={buttonVariants()}>
            Go to Today
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Homepage
          </Link>
        </div>
      </main>
    </div>
  );
}

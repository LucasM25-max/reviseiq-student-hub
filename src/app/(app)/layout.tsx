import { Settings } from "lucide-react";
import Link from "next/link";

import { AppNav } from "@/components/app/app-nav";
import { VerifyBanner } from "@/components/app/verify-banner";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireOnboardedUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Everything below this point can assume a signed-in, onboarded student.
  const user = await requireOnboardedUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable absolute top-4 left-4 z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Skip to content
      </a>

      {!user.isEmailVerified ? <VerifyBanner email={user.email} /> : null}

      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-2 sm:px-8">
          <Link href="/today" className="rounded-md" aria-label="ReviseIQ home">
            <LogoMark className="size-6 text-primary" />
          </Link>

          <AppNav />

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              href="/settings"
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="size-4" aria-hidden="true" />
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}

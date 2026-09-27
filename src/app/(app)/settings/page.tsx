import type { Metadata } from "next";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  ListChecks,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { ResendVerification } from "@/components/auth/resend-verification";
import { AccountForm, PreferencesForm } from "@/components/settings/account-form";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  {
    href: "/settings/subjects",
    title: "Subjects",
    description: "Add or drop a science.",
    Icon: Sparkles,
  },
  {
    href: "/settings/exams",
    title: "Tier and exam dates",
    description: "Year group, tier, and when you sit your papers.",
    Icon: CalendarDays,
  },
  {
    href: "/settings/ratings",
    title: "Topic ratings",
    description: "Change a rating as your confidence changes.",
    Icon: ListChecks,
  },
  {
    href: "/settings/availability",
    title: "Your week",
    description: "Revision time, daily goal and reminders.",
    Icon: Clock,
  },
] as const;

export default async function SettingsPage() {
  const user = await requireOnboardedUser();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Everything you told us during setup, changeable at any time.
        </p>
      </header>

      <nav aria-label="Settings sections">
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {SECTIONS.map(({ href, title, description, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{title}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {user.isEmailVerified ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              Email confirmed
            </p>
          ) : (
            <div className="space-y-3 rounded-lg border border-warning-border bg-warning-surface p-3">
              <p className="text-sm text-foreground">
                Your email isn&apos;t confirmed yet. Password resets and reminders need it.
              </p>
              <ResendVerification label="Send the link again" />
            </div>
          )}

          <AccountForm name={user.name ?? ""} />

          {!user.hasPassword ? (
            <p className="text-xs text-muted-foreground">
              You signed up with Google, so there&apos;s no password on this account.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance and accessibility</CardTitle>
          <CardDescription>
            ReviseIQ targets WCAG 2.2 AA. If something here doesn&apos;t work for you,
            that&apos;s a bug worth reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">Follows your device by default.</p>
            </div>
            <ThemeToggle />
          </div>

          <PreferencesForm reduceMotion={user.profile?.reduceMotion ?? false} />
        </CardContent>
      </Card>
    </div>
  );
}

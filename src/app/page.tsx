import { BookOpen, CalendarCheck, FileQuestion, Layers } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { RAG_CLASSES, RAG_META, RAG_ORDER } from "@/lib/rag";
import { cn } from "@/lib/utils";

const PAGES = [
  {
    Icon: CalendarCheck,
    title: "Today",
    body: "One plan, built from what you know, when your exams are and how long you've actually got. Every task links straight to the thing it's asking for.",
  },
  {
    Icon: BookOpen,
    title: "Learn",
    body: "Interactive lessons across the whole specification — taught step by step, with checks along the way so you can't drift.",
  },
  {
    Icon: Layers,
    title: "Revise",
    body: "Condensed notes, and flashcards made from the questions you got wrong, scheduled so they come back just before you'd forget.",
  },
  {
    Icon: FileQuestion,
    title: "Test",
    body: "Exam questions on every topic and full timed papers. Written answers are marked against the mark scheme, point by point.",
  },
] as const;

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
        <Wordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          {user ? (
            <Link href="/today" className={buttonVariants({ size: "sm" })}>
              Go to Today
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Log in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 sm:px-8">
        <section className="py-14 sm:py-24">
          <p className="mb-3 text-sm font-medium text-primary">
            AQA GCSE Biology, Chemistry, Physics
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Revision that knows what you need to do today.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Tell ReviseIQ what you know, when your exams are and how much time you have. It
            works out the rest — and then tells you exactly what to do, one day at a time.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Create a free account
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              I already have one
            </Link>
          </div>
        </section>

        <section aria-labelledby="four-pages" className="border-t border-border py-14">
          <h2 id="four-pages" className="text-2xl font-semibold tracking-tight">
            Four pages, one job each
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PAGES.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="rag" className="border-t border-border py-14">
          <h2 id="rag" className="text-2xl font-semibold tracking-tight">
            It starts with an honest self-assessment
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Rate every topic once. That rating decides what you get and in what order — and you
            can change it whenever your confidence does.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {RAG_ORDER.map((value) => {
              const meta = RAG_META[value];
              return (
                <li
                  key={value}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      RAG_CLASSES[value].dot,
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-sm text-muted-foreground">{meta.consequence}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground sm:px-8">
          <p>ReviseIQ — built for UK GCSE students.</p>
          <p>Not affiliated with AQA.</p>
        </div>
      </footer>
    </div>
  );
}

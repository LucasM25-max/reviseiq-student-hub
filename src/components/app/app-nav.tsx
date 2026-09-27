"use client";

import { BookOpen, CalendarCheck, FileQuestion, Layers } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** The four pages the whole product is organised around (doc 01 §1). */
export const NAV_ITEMS = [
  { href: "/today", label: "Today", Icon: CalendarCheck },
  { href: "/learn", label: "Learn", Icon: BookOpen },
  { href: "/revise", label: "Revise", Icon: Layers },
  { href: "/test", label: "Test", Icon: FileQuestion },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="min-w-0">
      <ul className="flex items-center gap-0.5 overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

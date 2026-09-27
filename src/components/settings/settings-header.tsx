import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function SettingsHeader({ title, blurb }: { title: string; blurb: string }) {
  return (
    <header className="mb-6">
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Settings
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-muted-foreground">{blurb}</p>
    </header>
  );
}

import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export function SignOutButton({ label = "Log out" }: { label?: string }) {
  return (
    <form action={signOutAction}>
      <SubmitButton variant="ghost" size="sm" pendingLabel="Logging out…">
        <LogOut aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </SubmitButton>
    </form>
  );
}

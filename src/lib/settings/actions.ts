"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { checkbox, formError, formSuccess, text, type FormState } from "@/lib/forms";

export async function updateAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return formError("Your session has expired. Log in and try again.");

  const name = text(formData, "name");

  if (name && name.length > 80) {
    return formError("That's a bit long — 80 characters max.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: name ?? null },
  });

  revalidatePath("/settings");
  return formSuccess("Saved.");
}

export async function updatePreferencesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return formError("Your session has expired. Log in and try again.");

  await prisma.studentProfile.update({
    where: { userId: user.id },
    data: {
      // An explicit override on top of the OS-level `prefers-reduced-motion`, for
      // students whose device setting doesn't match how they want the app to behave.
      reduceMotion: checkbox(formData, "reduceMotion"),
    },
  });

  revalidatePath("/settings");
  return formSuccess("Saved.");
}

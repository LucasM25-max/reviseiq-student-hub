/**
 * Shared shape for every server action that backs a form.
 *
 * `useActionState` needs a serialisable value it can render, so actions never throw for
 * expected failures — they return a FormState. `message` is the banner at the top of the
 * form; `fieldErrors` sit under individual inputs.
 */
export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Free-form payload for the rare action that needs to hand something back. */
  data?: Record<string, string>;
};

export const idleFormState: FormState = { ok: false };

export function formError(message: string, fieldErrors?: Record<string, string>): FormState {
  return { ok: false, message, fieldErrors };
}

export function fieldError(field: string, message: string): FormState {
  return { ok: false, fieldErrors: { [field]: message } };
}

export function formSuccess(message?: string, data?: Record<string, string>): FormState {
  return { ok: true, message, data };
}

/** Reads a text field from FormData, trimming and normalising "" to undefined. */
export function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Reads a checkbox: present and not "false" means checked. */
export function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return typeof value === "string" && value !== "false" && value !== "";
}

/** Reads every value for a repeated field (checkbox groups, multi-selects). */
export function textList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

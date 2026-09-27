import { describe, expect, it } from "vitest";

import { checkbox, fieldError, formError, formSuccess, text, textList } from "@/lib/forms";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("text", () => {
  it("trims and returns a value", () => {
    expect(text(form([["name", "  Ada  "]]), "name")).toBe("Ada");
  });

  it("treats blank and missing the same", () => {
    expect(text(form([["name", "   "]]), "name")).toBeUndefined();
    expect(text(form([]), "name")).toBeUndefined();
  });
});

describe("checkbox", () => {
  it("reads an unchecked box as false", () => {
    expect(checkbox(form([]), "reduceMotion")).toBe(false);
  });

  it("reads a checked box as true", () => {
    expect(checkbox(form([["reduceMotion", "on"]]), "reduceMotion")).toBe(true);
  });

  it("honours an explicit false", () => {
    expect(checkbox(form([["reduceMotion", "false"]]), "reduceMotion")).toBe(false);
    expect(checkbox(form([["reduceMotion", ""]]), "reduceMotion")).toBe(false);
  });
});

describe("textList", () => {
  it("collects every value for a repeated field", () => {
    const data = form([
      ["subjectId", "aqa-biology"],
      ["subjectId", "aqa-physics"],
    ]);
    expect(textList(data, "subjectId")).toEqual(["aqa-biology", "aqa-physics"]);
  });

  it("drops blanks and trims the rest", () => {
    const data = form([
      ["subjectId", " aqa-biology "],
      ["subjectId", "  "],
    ]);
    expect(textList(data, "subjectId")).toEqual(["aqa-biology"]);
  });

  it("returns an empty list when nothing was selected", () => {
    expect(textList(form([]), "subjectId")).toEqual([]);
  });
});

describe("form state helpers", () => {
  it("marks errors as not ok", () => {
    expect(formError("Nope")).toEqual({ ok: false, message: "Nope", fieldErrors: undefined });
    expect(fieldError("email", "Bad")).toEqual({ ok: false, fieldErrors: { email: "Bad" } });
  });

  it("marks success as ok", () => {
    expect(formSuccess("Saved.")).toEqual({ ok: true, message: "Saved.", data: undefined });
  });
});

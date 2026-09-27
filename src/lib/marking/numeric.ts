/**
 * Reading a number out of what a student actually typed.
 *
 * D49 gave numeric questions an `accept: { min, max }` window precisely so their final
 * value could be judged in-app, deterministically, and never sent to a language model.
 * This module is that judgement. Phase 4 uses it to tell a student whether their value
 * landed before they self-mark; Phase 5's marker uses the same function, so the two can
 * never disagree about whether "60µm" is 60 micrometres.
 *
 * Everything here is pure and covered by unit tests, because the failure mode — quietly
 * reading "×499" as 499 in one place and as null in another — is invisible until a
 * student is told they are wrong when they are right.
 */

export type Quantity = {
  value: number;
  /** Exactly what followed the number, trimmed. Null when the answer was bare. */
  unit: string | null;
};

/**
 * Micro is written at least three ways in the wild: the dedicated MICRO SIGN (U+00B5),
 * the Greek letter mu (U+03BC), and a plain "u" from a student who could not find
 * either. All three mean the same thing and all three are accepted.
 */
export function normaliseUnit(unit: string | null | undefined): string | null {
  if (unit == null) return null;

  const cleaned = unit
    .trim()
    .toLowerCase()
    .replaceAll("\u00b5", "u") // MICRO SIGN
    .replaceAll("\u03bc", "u") // GREEK SMALL LETTER MU
    .replaceAll("\u00b2", "2") // superscript two
    .replaceAll("\u00b3", "3") // superscript three
    .replaceAll("^", "")
    .replace(/\s+/g, "")
    .replace(/s$/, ""); // "micrometres" → "micrometre"; harmless for symbols

  return cleaned === "" ? null : cleaned;
}

/** Leading hedges a student may write before the value itself. */
const LEADING_NOISE = /^(?:about|approx\.?|approximately|roughly|around|~|≈|=|\+)\s*/i;

/**
 * A magnification is conventionally written "×400". The multiplication sign there is
 * part of the notation, not an operator, so it is stripped before parsing — but only
 * when it leads, never in the middle, where it really is "× 10".
 */
const LEADING_TIMES = /^[×x*]\s*(?=[\d.]|10\s*[\^*])/i;

const QUANTITY = new RegExp(
  [
    "^",
    "([+-]?\\d*\\.?\\d+)", // 1 — mantissa
    "\\s*",
    "(?:",
    "(?:[×x*]\\s*10\\s*(?:\\^|\\*\\*)?\\s*([+-]?\\d+))", // 2 — ×10^n
    "|",
    "(?:[eE]([+-]?\\d+))", // 3 — e-notation
    ")?",
    "\\s*",
    "(.*)$", // 4 — trailing unit
  ].join(""),
);

/**
 * Parses the first quantity in a free-text answer, or null if there isn't one.
 *
 * Handles `60`, `60 µm`, `1 × 10^-4 m`, `1e-4`, `×499.4`, `10^4`, and `1,200 nm`.
 * Deliberately does *not* try to evaluate arithmetic: "300 ÷ 5" is working, not an
 * answer, and a marker that silently computed it would award the answer mark for a
 * question the student had not finished.
 */
export function parseQuantity(input: string | null | undefined): Quantity | null {
  if (input == null) return null;

  let text = input.trim();
  if (text === "") return null;

  // Thousands separators, but only between digits — never touch a comma used as prose.
  text = text.replace(/(\d),(?=\d{3}\b)/g, "$1");
  text = text.replace(LEADING_NOISE, "");
  text = text.replace(LEADING_TIMES, "");

  // A bare power of ten has an implied mantissa of 1.
  text = text.replace(/^10\s*(?:\^|\*\*)\s*([+-]?\d+)/, "1×10^$1");

  const match = QUANTITY.exec(text);
  if (!match) return null;

  const mantissa = Number.parseFloat(match[1]);
  if (!Number.isFinite(mantissa)) return null;

  const exponent = match[2] ?? match[3];

  // Built as a decimal string rather than by multiplying, because `1 * 10 ** -4` is
  // 0.00009999999999999999 — JavaScript computes that power in floating point — and a
  // value that lands a hair below a tolerance boundary would mark a right answer wrong.
  // `Number("1e-4")` goes through the decimal parser and is exact.
  const value = exponent ? Number(`${match[1]}e${Number.parseInt(exponent, 10)}`) : mantissa;
  if (!Number.isFinite(value)) return null;

  const rest = (match[4] ?? "").trim();

  return { value, unit: rest === "" ? null : rest };
}

export type NumericSpec = {
  accept: { min: number; max: number };
  unit?: string;
  significantFigures?: number;
};

export type NumericVerdict = {
  /** What we managed to read, if anything. */
  parsed: Quantity | null;
  /** True when the value sits inside the accepted window. */
  inRange: boolean;
  /**
   * Null when the question is dimensionless (a magnification takes no unit), otherwise
   * whether the student's unit matches the one the mark scheme requires.
   */
  unitOk: boolean | null;
  /** One sentence to show the student. Never says "correct" — only what was checked. */
  summary: string;
};

/**
 * Checks a typed answer against a numeric mark scheme.
 *
 * This returns a *verdict*, not a mark. A three-mark calculation has method marks that no
 * regular expression can award, and pretending otherwise would systematically under-mark
 * a student who did everything right and slipped at the last step. The verdict tells them
 * whether the value landed; the mark scheme next to it tells them about the method.
 */
export function checkNumericAnswer(spec: NumericSpec, answer: string | null): NumericVerdict {
  const parsed = parseQuantity(answer);

  if (!parsed) {
    return {
      parsed: null,
      inRange: false,
      unitOk: spec.unit ? false : null,
      summary: "We couldn't find a number in that answer.",
    };
  }

  const inRange = parsed.value >= spec.accept.min && parsed.value <= spec.accept.max;

  const expectedUnit = normaliseUnit(spec.unit);
  const givenUnit = normaliseUnit(parsed.unit);
  const unitOk = expectedUnit === null ? null : givenUnit === expectedUnit;

  const parts: string[] = [];
  parts.push(
    inRange
      ? `Your value (${formatValue(parsed.value)}) is inside the accepted range.`
      : `Your value (${formatValue(parsed.value)}) is outside the accepted range of ${formatValue(spec.accept.min)} to ${formatValue(spec.accept.max)}.`,
  );

  if (expectedUnit !== null) {
    if (givenUnit === null) {
      parts.push(`No unit given — this question needs ${spec.unit}.`);
    } else if (!unitOk) {
      parts.push(`Unit given as "${parsed.unit}"; this question needs ${spec.unit}.`);
    } else {
      parts.push("Unit correct.");
    }
  }

  return { parsed, inRange, unitOk, summary: parts.join(" ") };
}

/** Trims float noise without rounding away a genuinely precise answer. */
function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Number(value.toPrecision(6));
  return String(rounded);
}

/**
 * Turning what a student typed into something comparable.
 *
 * Shared by the exact-answer cache and the deterministic fallback marker, which is the
 * point: if the two disagreed about whether two answers are "the same", a cached mark
 * could be served for an answer the fallback would have marked differently.
 *
 * Pure, dependency-free and covered by unit tests.
 */

/**
 * Words that carry no marking signal. Kept deliberately short — a long stop list
 * starts removing words that matter in science ("not", "no", "all" change meaning),
 * so negations and quantifiers are retained on purpose.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "might",
  "of",
  "on",
  "or",
  "our",
  "out",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "up",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "while",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

/**
 * GCSE synonyms and inflections folded to one token.
 *
 * Only pairs that genuinely mean the same thing in a mark scheme. Anything where the
 * distinction could itself be the mark point — "cell wall" vs "cell membrane",
 * "diffusion" vs "osmosis" — is deliberately absent.
 */
const SYNONYMS = new Map<string, string>([
  ["mitochondrion", "mitochondria"],
  ["chloroplasts", "chloroplast"],
  ["ribosomes", "ribosome"],
  ["nuclei", "nucleus"],
  ["cells", "cell"],
  ["walls", "wall"],
  ["membranes", "membrane"],
  ["vacuoles", "vacuole"],
  ["organelles", "organelle"],
  ["enzymes", "enzyme"],
  ["proteins", "protein"],
  ["chromosomes", "chromosome"],
  ["genes", "gene"],
  ["bacterium", "bacteria"],
  ["magnified", "magnification"],
  ["magnify", "magnification"],
  ["respire", "respiration"],
  ["respires", "respiration"],
  ["releases", "release"],
  ["released", "release"],
  ["releasing", "release"],
  ["controls", "control"],
  ["controlling", "control"],
  ["contains", "contain"],
  ["containing", "contain"],
  ["supports", "support"],
  ["supporting", "support"],
  ["stores", "store"],
  ["storing", "store"],
  ["makes", "make"],
  ["making", "make"],
  ["produces", "make"],
  ["produce", "make"],
  ["produced", "make"],
  ["producing", "make"],
  ["synthesises", "make"],
  ["synthesise", "make"],
  ["energy", "energy"],
  ["photosynthesises", "photosynthesis"],
  ["photosynthesise", "photosynthesis"],
  ["absorbs", "absorb"],
  ["absorbed", "absorb"],
  ["absorbing", "absorb"],
  ["larger", "large"],
  ["bigger", "large"],
  ["big", "large"],
  ["smaller", "small"],
  ["tiny", "small"],
  ["rigid", "strong"],
  ["stiff", "strong"],
  ["shape", "structure"],
]);

/** Lowercase, fold unicode punctuation, collapse whitespace. */
export function normaliseText(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // combining accents
      .toLowerCase()
      .replaceAll("\u00b5", "u") // MICRO SIGN
      .replaceAll("\u03bc", "u") // GREEK SMALL LETTER MU
      .replace(/['’`]/g, "")
      // Dropped before the general pass so "10^-4" stays one token rather than
      // splitting into "10" and "-4".
      .replaceAll("^", "")
      .replace(/[^a-z0-9+\-.]+/g, " ")
      // A full stop only means something between digits. Sentence-ending dots must go,
      // or "the cell." and "the cell!" would hash to different cache keys.
      .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** The cache key's view of an answer: identical text must produce identical keys. */
export const normaliseForCache = normaliseText;

/**
 * Endings where a trailing "s" is part of the word, not a plural.
 *
 * Without this, "nucleus" stems to "nucleu" and stops matching the mark scheme's
 * "nucleus" — the single most common word in this topic.
 */
const NOT_PLURAL = ["ss", "us", "is", "os", "as"];

const stem = (token: string): string => {
  const mapped = SYNONYMS.get(token);
  if (mapped) return mapped;

  // A single conservative rule: plural "-s" on a word long enough to survive it.
  if (
    token.length > 4 &&
    token.endsWith("s") &&
    !NOT_PLURAL.some((ending) => token.endsWith(ending))
  ) {
    const singular = token.slice(0, -1);
    return SYNONYMS.get(singular) ?? singular;
  }

  return token;
};

/** Content tokens, stopped and folded. Order is not preserved. */
export function contentTokens(input: string): string[] {
  return normaliseText(input)
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .map(stem);
}

export const tokenSet = (input: string): Set<string> => new Set(contentTokens(input));

/**
 * How much of `expected` appears in `actual`, 0–1.
 *
 * Recall of the expected phrasing rather than similarity, because a student who writes
 * a long correct answer containing the required idea should score: extra words are not
 * evidence against them. An expected phrase with no content tokens scores 0 rather
 * than 1, so an empty mark point can never be awarded for free.
 */
export function coverage(
  expected: string,
  actual: string,
  /**
   * Tokens that carry no credit, normally those already in the question stem.
   *
   * Echoing the question is not evidence of knowing the answer. Without this,
   * "plant cells are green" covers two thirds of "plant cells have a cell wall"
   * purely by repeating the subject, and scores a mark it has not earned.
   */
  ignore?: ReadonlySet<string>,
): number {
  let want = tokenSet(expected);

  if (ignore && ignore.size > 0) {
    const distinctive = new Set([...want].filter((token) => !ignore.has(token)));
    // If the point is made *entirely* of stem words there is nothing distinctive to
    // ask for, so fall back to judging it whole rather than dividing by zero.
    if (distinctive.size > 0) want = distinctive;
  }

  if (want.size === 0) return 0;

  const have = tokenSet(actual);
  let hit = 0;
  for (const token of want) if (have.has(token)) hit += 1;

  return hit / want.size;
}

/** Whether a rejected phrasing is present, using the same folding as everything else. */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const needleTokens = contentTokens(phrase);
  if (needleTokens.length === 0) return false;

  const hayTokens = contentTokens(haystack);
  if (needleTokens.length > hayTokens.length) return false;

  // Contiguous run, so "does not control" cannot match "control".
  for (let i = 0; i <= hayTokens.length - needleTokens.length; i += 1) {
    let all = true;
    for (let j = 0; j < needleTokens.length; j += 1) {
      if (hayTokens[i + j] !== needleTokens[j]) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

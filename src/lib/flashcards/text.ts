/**
 * Card text (doc 07 §2).
 *
 * The front and back depend only on (question, mark point, spec point) — never on who
 * missed it — which is why a template is generated once and shared by every student.
 * At steady state creating a card is a free database lookup.
 *
 * Two generators behind one shape. The deterministic one uses the mark scheme's own
 * words and always works, including with no API key; the model improves the phrasing
 * when one is configured. Both are labelled in `generatedBy`, so a template written
 * by the weaker path can be found and reissued later rather than silently persisting.
 */

import type { CardType } from "@/generated/prisma/enums";

export const CARD_TEXT_VERSION = "cardTextV1";
export const DETERMINISTIC_GENERATOR = `deterministic:${CARD_TEXT_VERSION}`;

export type CardTextInput = {
  /** The idea the student missed, in the mark scheme's language. */
  markPointText: string;
  /** What the specification says, which is what the card is really testing. */
  specPointStatement: string;
  commandWord: string;
};

export type CardText = {
  front: string;
  back: string;
  hint: string | null;
  cardType: CardType;
};

/** Equations and ordered sequences are recalled best with a gap to fill. */
function looksLikeEquation(text: string): boolean {
  return /[=×÷]|\bequals\b/.test(text);
}

/** "A — cell wall", "mitochondrion: site of respiration" — terminology. */
function looksLikeDefinition(text: string): boolean {
  return /^[^.?!]{1,40}\s[—:-]\s/.test(text.trim());
}

export function classifyCard(markPointText: string): CardType {
  if (looksLikeEquation(markPointText)) return "CLOZE";
  if (looksLikeDefinition(markPointText)) return "DEFINITION";
  return "QA";
}

/** Trims to one sentence, so a front is never a paragraph. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const stop = /[.?!](\s|$)/.exec(trimmed);
  return stop ? trimmed.slice(0, stop.index + 1).trim() : trimmed;
}

const withQuestionMark = (text: string): string =>
  /[?]$/.test(text.trim()) ? text.trim() : `${text.trim()}?`;

/**
 * Card text from the mark scheme alone.
 *
 * Deliberately conservative. It asks for the specification statement and answers with
 * the mark point, which is accurate by construction — it cannot invent science,
 * because every word came from content a human wrote. It reads a little stiffly, and
 * that is the trade: correct and dull beats fluent and wrong on a revision card.
 */
export function deterministicCardText(input: CardTextInput): CardText {
  const statement = firstSentence(input.specPointStatement) || input.specPointStatement;
  const answer = input.markPointText.trim();

  const cardType = classifyCard(answer);

  const front =
    cardType === "DEFINITION"
      ? withQuestionMark(
          `What does the specification say about: ${statement.replace(/\.$/, "")}`,
        )
      : withQuestionMark(`${statement.replace(/\.$/, "")} — what is the key point`);

  return {
    front,
    back: answer,
    // Never references the original question: the card has to stand alone.
    hint: null,
    cardType,
  };
}

/**
 * Whether a generated front is usable.
 *
 * Guards the model's output before it becomes a template shared with every student.
 * A front that restates the answer teaches nothing, and one that refers to "the graph
 * above" is meaningless on a card.
 */
export function isUsableCardText(text: CardText, input: CardTextInput): boolean {
  const front = text.front.trim();
  const back = text.back.trim();

  if (front.length < 8 || back.length < 2) return false;
  if (front.length > 300 || back.length > 600) return false;

  // The front must not contain the answer.
  const answerWords = input.markPointText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  if (answerWords.length > 0) {
    const frontLower = front.toLowerCase();
    const leaked = answerWords.filter((word) => frontLower.includes(word)).length;
    if (leaked / answerWords.length > 0.6) return false;
  }

  // The card must stand alone (doc 07 §2).
  if (/\b(above|below|in the (figure|graph|table|diagram)|figure \d|table \d)\b/i.test(front)) {
    return false;
  }

  return true;
}

#!/usr/bin/env node
/**
 * End-to-end smoke test for Phases 0–2.
 *
 *   npm run dev            # in one terminal
 *   npm run smoke          # in another
 *
 * Drives the real HTTP application the way a browser with JavaScript disabled would:
 * it reads each page, extracts the hidden Server Action fields React renders for
 * progressive enhancement, and posts them back as multipart form data. That means it
 * exercises the actual server actions, the actual proxy redirects and the actual
 * database — and it proves the whole product still works without client-side JS.
 *
 * Covers Phase 2's exit criterion end to end: a new account completes onboarding and
 * lands on Today.
 *
 * Environment:
 *   SMOKE_BASE_URL   default http://127.0.0.1:3000
 *   DATABASE_URL     required — used only to clear rate-limit buckets between runs
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
import pg from "pg";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const jar = new Map();

// ---------------------------------------------------------------------------
// HTTP plumbing with a cookie jar
// ---------------------------------------------------------------------------

const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

function storeCookies(response) {
  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "" || /expires=Thu, 01 Jan 1970/i.test(cookie)) jar.delete(name);
    else jar.set(name, value);
  }
}

async function request(path, init = {}) {
  const response = await fetch(new URL(path, BASE), {
    ...init,
    redirect: "manual",
    headers: {
      // Server Actions expect a same-origin request, exactly as a browser sends.
      origin: new URL(BASE).origin,
      ...(init.headers ?? {}),
      cookie: cookieHeader(),
    },
  });
  storeCookies(response);
  return response;
}

/** GET, following redirects, returning the final page. */
async function get(path) {
  let url = path;
  for (let hop = 0; hop < 6; hop += 1) {
    const response = await request(url);
    if (response.status >= 300 && response.status < 400) {
      url = response.headers.get("location");
      continue;
    }
    return { status: response.status, url, body: await response.text() };
  }
  throw new Error(`too many redirects from ${path}`);
}

const decode = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * Finds the form containing `needle` and returns its hidden Server Action fields.
 * Selecting by content rather than position matters: the app shell renders a sign-out
 * form above the page's own form on most screens.
 */
function actionFields(html, needle, { last = false } = {}) {
  const forms = html.split(/<form\b/).slice(1);
  const matching =
    needle === null
      ? forms.slice(0, 1)
      : forms.filter((candidate) =>
          candidate.slice(0, candidate.indexOf("</form>")).includes(needle),
        );

  // A lesson shows every step it has revealed, so several answered checks can match the
  // same needle. `last` picks the newest one — the gate the student is actually on.
  const form = last ? matching[matching.length - 1] : matching[0];

  if (!form) throw new Error(`no form containing ${JSON.stringify(needle)}`);

  const fields = {};
  for (const tag of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (name) fields[decode(name)] = decode(/value="([^"]*)"/.exec(tag)?.[1] ?? "");
  }

  if (!Object.keys(fields).some((key) => key.startsWith("$ACTION"))) {
    throw new Error(`form containing ${JSON.stringify(needle)} has no server action`);
  }
  return fields;
}

async function submit(path, html, values, needle = null, headers = {}, options = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(actionFields(html, needle, options)))
    body.append(key, value);
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => body.append(key, item));
    else body.append(key, value);
  }
  const response = await request(path, { method: "POST", body, headers });
  return {
    status: response.status,
    location: response.headers.get("location"),
    body: await response.text(),
  };
}

// ---------------------------------------------------------------------------
// Reading links out of "sent" email
// ---------------------------------------------------------------------------

/**
 * Finds the newest link of a given kind sent to an address.
 *
 * In development the app prints verification and reset links straight into the page,
 * which is the nicer thing to assert on. Under `next start` it does not, so fall back
 * to the mailbox the log transport writes to ./.mail. Either way no network is needed.
 */
async function linkFromMailbox(recipient, kind) {
  const inbox = path.join(process.cwd(), ".mail");
  const slug = recipient.replace(/[^a-z0-9]/gi, "_");
  const pattern = new RegExp(`https?://[^"\\s]*?/${kind}\\?token=[A-Za-z0-9_-]+`);

  let names;
  try {
    names = (await readdir(inbox))
      .filter((name) => name.includes(slug))
      .sort()
      .reverse();
  } catch {
    return null;
  }

  for (const name of names) {
    const found = pattern.exec(await readFile(path.join(inbox, name), "utf8"));
    if (found) return found[0].replace(/&amp;/g, "&");
  }
  return null;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** A server action that finishes by redirecting answers 303 to the no-JS client. */
const redirected = (result) => result.status === 303;

// ---------------------------------------------------------------------------
// Walk-through
// ---------------------------------------------------------------------------

{
  // Repeated runs from the same address would otherwise trip the limiters.
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(
    `DELETE FROM "RateBucket"
     WHERE "key" LIKE 'signup:%' OR "key" LIKE 'login:%'
        OR "key" LIKE 'passwordReset:%' OR "key" LIKE 'emailVerification:%'`,
  );
  await db.end();
}

const email = `smoke.${Date.now()}@example.test`;
const password = "photosynthesis-42-crumpet";

console.log(`\nReviseIQ smoke test against ${BASE}`);
console.log(`Account: ${email}\n`);

console.log("Public pages");
for (const [path, needle] of [
  ["/", "Revision that knows what you need"],
  ["/signup", "Create your account"],
  ["/login", "Welcome back"],
  ["/forgot-password", "Forgotten your password?"],
  ["/too-young", "Not quite yet"],
  ["/nope", "There&#x27;s nothing here"],
]) {
  const page = await get(path);
  const expected = path === "/nope" ? 404 : 200;
  check(
    `GET ${path}`,
    page.status === expected && page.body.includes(needle),
    `${page.status}`,
  );
}

console.log("\nRoute protection");
for (const path of [
  "/today",
  "/learn",
  "/revise",
  "/test",
  "/settings",
  "/onboarding/subjects",
]) {
  const response = await request(path);
  const location = response.headers.get("location") ?? "";
  check(
    `${path} redirects to /login when signed out`,
    response.status === 307 && location.includes("/login") && location.includes("next="),
    location.replace(BASE, ""),
  );
}

console.log("\nSign-up validation");
{
  const page = await get("/signup");
  const form = 'name="dateOfBirth"';

  const weak = await submit(
    "/signup",
    page.body,
    { email, password: "password123", dateOfBirth: "2009-05-17" },
    form,
  );
  check("rejects a blocklisted password", weak.body.includes("commonly used"));

  const young = await submit(
    "/signup",
    page.body,
    { email, password, dateOfBirth: "2018-01-01" },
    form,
  );
  check("rejects an under-13", young.body.includes("at least 13"));

  const impossible = await submit(
    "/signup",
    page.body,
    { email, password, dateOfBirth: "2011-02-30" },
    form,
  );
  check("rejects a date that doesn't exist", impossible.body.includes("doesn&#x27;t exist"));

  const badEmail = await submit(
    "/signup",
    page.body,
    { email: "not-an-email", password, dateOfBirth: "2009-05-17" },
    form,
  );
  check("rejects a malformed email", badEmail.body.includes("valid email"));
}

console.log("\nSign-up");
{
  const page = await get("/signup");
  const result = await submit(
    "/signup",
    page.body,
    { name: "Sam Okonkwo", email, password, dateOfBirth: "2009-05-17" },
    'name="dateOfBirth"',
  );
  const destination = `${result.location ?? ""}${result.body}`;
  check(
    "creates the account and starts onboarding",
    redirected(result) && destination.includes("/onboarding/subjects"),
    result.location ?? `${result.status}`,
  );
  check(
    "issues a session cookie",
    [...jar.keys()].some((key) => key.includes("session-token")),
  );
}

const signedInJar = new Map(jar);

{
  jar.clear();
  const page = await get("/signup");
  const duplicate = await submit(
    "/signup",
    page.body,
    { email, password, dateOfBirth: "2009-05-17" },
    'name="dateOfBirth"',
  );
  check("refuses a duplicate email", duplicate.body.includes("already an account"));
  jar.clear();
  for (const [key, value] of signedInJar) jar.set(key, value);
}

console.log("\nOnboarding");
{
  const page = await get("/onboarding/subjects");
  check("step 1 renders", page.body.includes("Which sciences are you taking?"));

  const none = await submit("/onboarding/subjects", page.body, {}, 'name="subjectId"');
  check("step 1 requires a subject", none.body.includes("Pick at least one subject"));

  const saved = await submit(
    "/onboarding/subjects",
    page.body,
    { subjectId: ["aqa-biology", "aqa-chemistry", "aqa-physics"] },
    'name="subjectId"',
  );
  check("step 1 saves three subjects", redirected(saved), `${saved.status}`);
}

{
  const page = await get("/onboarding/setup");
  check("step 2 renders", page.body.includes("Your exams"));

  const examYear = /Summer (\d{4})/.exec(page.body)?.[1];
  check("step 2 offers an exam series", Boolean(examYear), `Summer ${examYear}`);

  const saved = await submit(
    "/onboarding/setup",
    page.body,
    {
      yearGroup: "YEAR_11",
      examYear,
      "tier:aqa-biology": "HIGHER",
      "tier:aqa-chemistry": "HIGHER",
      "tier:aqa-physics": "FOUNDATION",
    },
    'name="yearGroup"',
  );
  check("step 2 saves", redirected(saved), `${saved.status}`);
}

{
  const page = await get("/onboarding/rag");
  check("step 3 renders", page.body.includes("Where are you up to?"));

  const topicIds = [
    ...new Set([...page.body.matchAll(/name="rag:([^"]+)"/g)].map((m) => m[1])),
  ];
  check("step 3 lists all 25 topics", topicIds.length === 25, `${topicIds.length}`);

  const partial = Object.fromEntries(topicIds.slice(0, 20).map((id) => [`rag:${id}`, "AMBER"]));
  const incomplete = await submit("/onboarding/rag", page.body, partial, 'name="rag:');
  check("step 3 refuses a partial submission", incomplete.body.includes("still need a rating"));

  const values = ["NOT_LEARNT", "RED", "AMBER", "GREEN"];
  const all = Object.fromEntries(topicIds.map((id, i) => [`rag:${id}`, values[i % 4]]));
  const saved = await submit("/onboarding/rag", page.body, all, 'name="rag:');
  check("step 3 saves every rating", redirected(saved), `${saved.status}`);
}

{
  const page = await get("/onboarding/availability");
  check("step 4 renders", page.body.includes("When can you actually revise?"));

  const zeroes = Object.fromEntries(
    Array.from({ length: 7 }, (_, day) => [`minutes:${day}`, "0"]),
  );

  const empty = await submit(
    "/onboarding/availability",
    page.body,
    { ...zeroes, dailyGoalMinutes: "30", holidayGoalMinutes: "60", reminderChannel: "NONE" },
    'name="minutes:0"',
  );
  check("step 4 refuses an empty week", empty.body.includes("at least one slot"));

  const saved = await submit(
    "/onboarding/availability",
    page.body,
    {
      "minutes:0": "45",
      "minutes:1": "30",
      "minutes:2": "30",
      "minutes:3": "30",
      "minutes:4": "30",
      "minutes:5": "0",
      "minutes:6": "90",
      dailyGoalMinutes: "45",
      holidayGoalMinutes: "60",
      reminderChannel: "EMAIL",
      reminderTime: "18:30",
    },
    'name="minutes:0"',
  );
  check("step 4 saves", redirected(saved), `${saved.status}`);
}

console.log("\nThe app shell");
{
  const welcome = await get("/welcome");
  check("welcome page renders", welcome.body.includes("That&#x27;s you set up"));
  check("welcome summarises the setup", welcome.body.includes("25 topics rated"));

  const today = await get("/today");
  check("Today renders", today.body.includes("Your plan for today"));
  check("Today warns the email is unconfirmed", today.body.includes("Confirm your email"));
  check(
    "Today shows all three subjects",
    ["Biology", "Chemistry", "Physics"].every((name) => today.body.includes(name)),
  );

  for (const [path, needle] of [
    ["/learn", "Your syllabus"],
    ["/revise", "Revision aids come after"],
    ["/test", "Practise a topic"],
    ["/settings", "Topic ratings"],
    ["/settings/subjects", "Add a science"],
    ["/settings/exams", "Tier and exam dates"],
    ["/settings/ratings", "Move something to green"],
    ["/settings/availability", "How much time you have"],
  ]) {
    const page = await get(path);
    check(`GET ${path}`, page.status === 200 && page.body.includes(needle), `${page.status}`);
  }

  const reentry = await request("/onboarding/subjects");
  check(
    "onboarding can't be re-entered once finished",
    reentry.status === 307 && (reentry.headers.get("location") ?? "").includes("/today"),
  );

  const guestOnly = await request("/login");
  check(
    "signed-in students are bounced off /login",
    guestOnly.status === 307 && (guestOnly.headers.get("location") ?? "").includes("/today"),
  );

  /**
   * A session token outlives the account it names: it is a stateless JWT, signed with
   * a secret that survives a rebuilt database. So a token can decode perfectly while
   * the user behind it is gone — deleted, soft-deleted, or wiped with the database.
   *
   * Deciding "signed in" from the token alone used to trap that student in a loop with
   * no exit: /login saw a token and forwarded to /today, /today looked the account up,
   * found nothing and forwarded back. The login form has to stay reachable.
   */
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const soft = await db.query(
    `UPDATE "User" SET "deletedAt" = now() WHERE "email" = $1 AND "deletedAt" IS NULL`,
    [email],
  );

  try {
    check(
      "the account can be soft-deleted for the next check",
      soft.rowCount === 1,
      `${soft.rowCount} row(s)`,
    );

    const orphanedLogin = await request("/login");
    check(
      "a token for a deleted account can still reach the login form",
      orphanedLogin.status === 200,
      `${orphanedLogin.status} → ${orphanedLogin.headers.get("location") ?? "no redirect"}`,
    );

    const orphanedToday = await request("/today");
    check(
      "  — and a protected page sends it there rather than looping",
      orphanedToday.status === 307 &&
        (orphanedToday.headers.get("location") ?? "").includes("/login"),
      `${orphanedToday.status} → ${orphanedToday.headers.get("location") ?? "no redirect"}`,
    );
  } finally {
    await db.query(`UPDATE "User" SET "deletedAt" = NULL WHERE "email" = $1`, [email]);
    await db.end();
  }
}

console.log("\nContent — Biology 4.1.1 (Phase 3)");
{
  // Everything below is server-rendered from the seeded content tables, so these checks
  // prove the whole pipeline end to end: /content → content:seed → Postgres → page.
  // They run with JavaScript disabled, like the rest of the smoke suite.
  const learn = await get("/learn");
  // React separates adjacent JSX expressions with an empty comment, so "{code} {title}"
  // serialises as `4.1.1<!-- --> <!-- -->Cell structure`. Assert on the parts.
  check(
    "Learn links the sub-topics that have lessons",
    learn.body.includes("/learn/biology/4-1-1") &&
      learn.body.includes("Cell structure") &&
      learn.body.includes("3 lessons"),
  );

  const index = await get("/learn/biology/4-1-1");
  check("the sub-topic index renders", index.status === 200, `${index.status}`);
  check(
    "it lists all three lessons",
    ["Inside animal and plant cells", "Why each part is there", "Required practical"].every(
      (title) => index.body.includes(title),
    ),
  );

  const lesson = await get("/learn/biology/4-1-1/inside-animal-and-plant-cells");
  check("lesson 1 renders", lesson.status === 200, `${lesson.status}`);
  check("markdown is rendered, not printed raw", !lesson.body.includes("**Most animal cells"));
  check("bold markdown became real markup", lesson.body.includes("<strong"));
  check("the hand-built SVG diagram is inlined", lesson.body.includes("<svg"));
  check("the diagram is labelled for screen readers", lesson.body.includes('role="img"'));
  check(
    "the KS3 recap is collapsible rather than hidden",
    lesson.body.includes("Recap from earlier study"),
  );
  check(
    "a check block reveals its answer without JavaScript",
    lesson.body.includes("Show the answer"),
  );
  check(
    "the built widgets render as real controls, not placeholders",
    lesson.body.includes("<select") && !lesson.body.includes("Phase 4"),
  );

  const maths = await get("/learn/biology/4-1-1/required-practical-microscopy");
  check("lesson 3 renders", maths.status === 200, `${maths.status}`);

  const notes = await get("/revise/biology/notes/4-1-1");
  check("revision notes render", notes.status === 200, `${notes.status}`);
  check(
    "every permanent anchor slug is present",
    [
      "animal-cells",
      "plant-cells",
      "functions",
      "estimating",
      "practical",
      "drawing-rules",
      "exam-technique",
    ].every((slug) => notes.body.includes(`id="${slug}"`)),
  );
  check("markdown tables become real tables", notes.body.includes("<table"));

  const practical = await get("/revise/biology/practicals/rp-1");
  check(
    "the required practical sheet renders",
    practical.status === 200,
    `${practical.status}`,
  );
  check(
    "all twenty method steps are listed",
    practical.body.includes("magnification of your drawing"),
  );
  check(
    "the fault table is shown as sources of error",
    practical.body.includes("Sources of error") &&
      practical.body.includes("bubbles are trapped") &&
      // The one fatal fault is flagged as ending the run.
      practical.body.includes("Ends the experiment"),
  );
  check(
    "the declared gap is shown to the student, not just the report",
    practical.body.includes("Partly covered so far"),
  );

  for (const [path, why] of [
    ["/learn/biology/9-9-9", "an unknown sub-topic"],
    ["/learn/biology/4-1-1/no-such-lesson", "an unknown lesson"],
    ["/revise/biology/notes/9-9-9", "notes for an unknown sub-topic"],
    ["/revise/biology/practicals/rp-99", "a practical that does not exist"],
    ["/revise/biology/practicals/not-a-practical", "a malformed practical slug"],
    ["/learn/geography/4-1-1", "a subject that does not exist"],
  ]) {
    const missing = await get(path);
    check(`404 for ${why}`, missing.status === 404, `${missing.status}`);
  }
}

console.log("\nLearn runner and mastery check (Phase 4)");
{
  // A whole lesson, walked from the first gate to a marked mastery check, with
  // JavaScript disabled throughout. This is the only place the step gating, the
  // progress writes and the four mastery states are exercised against a real browser
  // request rather than a unit test's idea of one.
  const LESSON = "/learn/biology/4-1-1/inside-animal-and-plant-cells";

  /** Every radio value offered by the form containing `needle`. */
  const radioValues = (html, needle) => {
    const forms = html
      .split(/<form\b/)
      .slice(1)
      .filter((candidate) => candidate.includes(needle));
    const form = forms[forms.length - 1];
    if (!form) return [];
    const body = form.slice(0, form.indexOf("</form>"));
    return [...body.matchAll(/<input[^>]*type="radio"[^>]*>/g)]
      .map((match) => /value="([^"]*)"/.exec(match[0])?.[1])
      .filter(Boolean);
  };

  const step1 = await get(LESSON);
  check("a new student starts on step 1", step1.status === 200, `${step1.status}`);
  check("later steps are not in the markup at all", !step1.body.includes("Permanent vacuole"));
  check("the progress rail says part 1", step1.body.includes("Part 1 of"));
  check(
    "the step cannot be left until its check is answered",
    step1.body.includes("Answer the check above to carry on"),
  );

  // Answer the gate wrongly first. The explanation should appear and the step should
  // open, but the first-attempt verdict is what gets recorded.
  const wrong = await submit(LESSON, step1.body, { answer: "A" }, 'name="answer"');
  check("answering the check redirects", redirected(wrong), `${wrong.status}`);

  const answered = await get(LESSON);
  check(
    "the explanation is revealed once answered",
    answered.body.includes("animals do not photosynthesise"),
  );
  check(
    "the radios are locked so the answer cannot be changed after the reveal",
    answered.body.includes("disabled"),
  );
  check("and now there is a way forward", answered.body.includes("Continue"));

  const toStep2 = await submit(LESSON, answered.body, {}, 'name="toStage"');
  check("continuing redirects", redirected(toStep2), `${toStep2.status}`);

  const step2 = await get(LESSON);
  check(
    "step 2 reveals the next block of the lesson",
    step2.body.includes("Permanent vacuole"),
  );
  check("the rail moved on", step2.body.includes("Part 2 of"));
  check("step 1 is still on the page, not replaced", step2.body.includes("Show the answer"));

  // Reloading must not lose the place — the whole point of storing progress.
  const reloaded = await get(LESSON);
  check("a reload keeps the student where they were", reloaded.body.includes("Part 2 of"));

  /**
   * Answers every gate and presses Continue until the lesson offers to finish.
   *
   * Returns the last page, or null if it got stuck — which is the failure worth
   * catching, because a student who cannot reach the end of a lesson has no way to
   * report anything more specific than "it stopped".
   */
  const walkToEnd = async (path, start) => {
    let page = start;
    for (let guard = 0; guard < 16; guard += 1) {
      if (page.body.includes("Finish and check what stuck")) return page;

      if (page.body.includes("Answer the check above to carry on")) {
        const values = radioValues(page.body, 'name="answer"');
        await submit(
          path,
          page.body,
          { answer: values[values.length - 1] ?? "A" },
          'name="answer"',
          {},
          { last: true },
        );
        page = await get(path);
        continue;
      }

      if (!page.body.includes('name="toStage"')) return null;
      await submit(path, page.body, {}, 'name="toStage"');
      page = await get(path);
    }
    return null;
  };

  const page = await walkToEnd(LESSON, step2);
  check("the lesson can be walked to its last step", page !== null);

  const finished = await submit(LESSON, page?.body ?? step2.body, {}, 'name="finish"');
  check(
    "finishing redirects to the mastery check",
    finished.location?.includes("/mastery"),
    finished.location ?? `${finished.status}`,
  );

  const completed = await get(LESSON);
  check("a completed lesson says so", completed.body.includes("You have finished this lesson"));
  check(
    "and opens the whole thing for review",
    completed.body.includes("Permanent vacuole") && !completed.body.includes("Part 1 of"),
  );

  // ── The mastery check: intro → answer → self-mark → score ──
  const MASTERY = `${LESSON}/mastery`;

  const intro = await get(MASTERY);
  check("the mastery intro renders", intro.status === 200, `${intro.status}`);
  // React puts an empty comment between adjacent JSX expressions, so "{n} questions"
  // never appears as one string. Assert on the prose either side of the count.
  check(
    "it says what the check is made of",
    intro.body.includes("from the real exam bank") && intro.body.includes("in total"),
  );

  const started = await submit(MASTERY, intro.body, {}, 'name="lessonId"');
  check("starting a run redirects to it", redirected(started), `${started.status}`);
  check("the run id is in the URL", started.location?.includes("run="), started.location ?? "");

  const runUrl = started.location.startsWith("http")
    ? new URL(started.location).pathname + new URL(started.location).search
    : started.location;

  const questions = await get(runUrl);
  check("the questions render", questions.status === 200, `${questions.status}`);
  check("a multiple-choice question offers radios", questions.body.includes('type="radio"'));
  check("a written question offers a textarea", questions.body.includes("<textarea"));
  check(
    "no mark scheme is visible before the answers are in",
    !questions.body.includes("Mark scheme"),
  );

  // Submitting blank must be refused — a blank mastery check teaches nothing.
  const blank = await submit(runUrl, questions.body, {}, 'name="setId"');
  check(
    "a blank submission is refused",
    blank.body.includes("blank") || blank.body.includes("Have a go"),
  );

  // Answer everything: the right key where there is one, prose everywhere else.
  const answers = {};
  for (const match of questions.body.matchAll(/name="(key-[^"]+)"[^>]*value="([^"]*)"/g)) {
    answers[match[1]] ??= match[2];
  }
  for (const match of questions.body.matchAll(/name="(text-[^"]+)"/g)) {
    answers[match[1]] = "A cell wall is made of cellulose and supports the cell.";
  }
  check("every question got an answer", Object.keys(answers).length >= 3);

  const submitted = await submit(runUrl, questions.body, answers, 'name="setId"');
  check("answers are accepted", redirected(submitted), `${submitted.status}`);

  const marking = await get(runUrl);
  check(
    "the mark scheme appears once the answers are in",
    marking.body.includes("Mark scheme"),
  );
  check("the student's own answer is shown back to them", marking.body.includes("cellulose"));
  check("there is a mark box per self-marked question", marking.body.includes('name="mark-'));

  const marks = {};
  for (const match of marking.body.matchAll(/name="(mark-[^"]+)"/g)) marks[match[1]] = "1";
  const marked = await submit(runUrl, marking.body, marks, 'name="mark-');
  check("self-marks are accepted", redirected(marked), `${marked.status}`);

  const score = await get(runUrl);
  check("a score is shown", /\d+\s*\/\s*\d+/.test(score.body) || score.body.includes("%"));
  check("the finished run offers a retake", score.body.includes("again"));
  check("and the answers are still there to look back at", score.body.includes("cellulose"));

  // ── The same runner over a lesson with a different shape ──
  // Lesson 3 is the required practical: no diagram, an unbuilt widget, KaTeX, and a
  // worked example in the final step. Walking it proves the runner is driven by the
  // lesson's structure rather than by anything special about lesson 1.
  const PRACTICAL = "/learn/biology/4-1-1/required-practical-microscopy";

  const p1 = await get(PRACTICAL);
  check("the practical lesson is gated too", p1.body.includes("Part 1 of"));
  check(
    "its later steps are withheld like any other lesson",
    !p1.body.includes("120 ÷ 0.24 = 500"),
  );

  const pEnd = await walkToEnd(PRACTICAL, p1);
  check("the practical lesson can be walked to its end", pEnd !== null);

  if (pEnd) {
    await submit(PRACTICAL, pEnd.body, {}, 'name="finish"');
    const done = await get(PRACTICAL);
    check(
      "the microscope simulation renders, with no placeholder left anywhere",
      done.body.includes("Required practical: looking at onion cells") &&
        !done.body.includes("Phase 4b"),
    );
    check(
      "the simulation describes the field of view in words, not only in pixels",
      done.body.includes("Down the eyepiece:"),
    );
    check(
      "the bench offers the wrong technique as well as the right one",
      done.body.includes("Drop it flat") && done.body.includes("Lower it slowly with a needle"),
    );
    check("KaTeX typesets the magnification formula", done.body.includes("katex"));
    check(
      "the worked example reaches the right answer",
      done.body.includes("120 ÷ 0.24 = 500"),
    );
  }
}

console.log("\nEmail verification");
{
  const page = await get("/verify-email");
  check("check-your-inbox page renders", page.body.includes("Check your inbox"));

  const resent = await submit("/verify-email", page.body, {}, "$ACTION");
  const link =
    /https?:\/\/[^"\s]*?\/verify-email\?token=[A-Za-z0-9_-]+/.exec(resent.body)?.[0] ??
    (await linkFromMailbox(email, "verify-email"));
  check("resend produces a verification link", Boolean(link));

  if (link) {
    const path = new URL(link).pathname + new URL(link).search;
    const confirmed = await get(path);
    check("following the link confirms the email", confirmed.body.includes("Email confirmed"));

    const today = await get("/today");
    check("the banner is gone", !today.body.includes("Confirm your email"));

    const reuse = await get(path);
    check("a used link reports itself as used", reuse.body.includes("already been used"));
  }
}

console.log("\nSettings");
{
  const page = await get("/settings/availability");
  const saved = await submit(
    "/settings/availability",
    page.body,
    {
      "minutes:0": "60",
      "minutes:1": "15",
      "minutes:2": "15",
      "minutes:3": "15",
      "minutes:4": "15",
      "minutes:5": "15",
      "minutes:6": "60",
      dailyGoalMinutes: "15",
      holidayGoalMinutes: "90",
      reminderChannel: "NONE",
    },
    'name="minutes:0"',
  );
  check("availability can be changed later", redirected(saved), `${saved.status}`);

  const today = await get("/today");
  check("Today picks up the new goal", today.body.includes("min goal"));
}

console.log("\nSign out and back in");
{
  const today = await get("/today");
  const out = await submit("/today", today.body, {}, "Log out");
  check("sign out redirects", redirected(out), `${out.status}`);

  const after = await request("/today");
  check(
    "the session is gone",
    after.status === 307 && (after.headers.get("location") ?? "").includes("/login"),
  );

  const login = await get("/login");
  const wrong = await submit(
    "/login",
    login.body,
    { email, password: "definitely-not-it", next: "/today" },
    'name="password"',
  );
  check("a wrong password is refused", wrong.body.includes("don&#x27;t match"));

  const right = await submit(
    "/login",
    login.body,
    { email, password, next: "/today" },
    'name="password"',
  );
  check("the right password signs in", redirected(right), `${right.status}`);

  const back = await get("/today");
  check("back on Today", back.body.includes("Your plan for today"));
}

// The preview pane, tunnels and any reverse proxy put a different host in front of the
// server. Both of these used to break every form in that setup.
console.log("\nSecurity headers");
{
  const response = await fetch(new URL("/", BASE), { redirect: "manual" });
  const headers = response.headers;

  check("nosniff is set", headers.get("x-content-type-options") === "nosniff");
  check(
    "the referrer policy is set",
    headers.get("referrer-policy") === "strict-origin-when-cross-origin",
  );
  check(
    "the permissions policy locks down camera, mic and location",
    (headers.get("permissions-policy") ?? "").includes("camera=()"),
  );

  // `next start` sets NODE_ENV=production, so a frame guard keyed off that would fire
  // in a preview sandbox and blank the pane it is being previewed in. The guard is
  // keyed off a real deployment instead; here, it must be absent.
  check(
    "the preview stays embeddable — no frame guard off-deployment",
    !(headers.get("content-security-policy") ?? "").includes("frame-ancestors"),
    headers.get("content-security-policy") ?? "none",
  );
}

console.log("\nTest — practice and AI marking (Phase 5)");
{
  // The signed-in student from the walk-through above has finished onboarding.
  const test = await get("/test");
  check(
    "GET /test",
    test.status === 200 && test.body.includes("Practise a topic"),
    `${test.status}`,
  );

  const started = await submit("/test", test.body, {}, 'name="subTopicId"');
  check("starting a practice run", redirected(started), `${started.status}`);

  const runPath = started.location ?? "";
  check("  — lands on the run", runPath.startsWith("/test/practice/"), runPath);

  const run = await get(runPath);
  check(
    "the run shows a question and an answer box",
    run.status === 200 && /name="answer(Text|Key)"/.test(run.body),
    `${run.status}`,
  );

  // The mark scheme must not be on the page while the question is still open.
  check(
    "the mark scheme is not visible before answering",
    !run.body.includes("The full mark scheme"),
  );

  const isObjective = run.body.includes('name="answerKey"');
  const answered = await submit(
    runPath,
    run.body,
    isObjective
      ? { answerKey: "B" }
      : {
          answerText:
            "Plant cells have a cellulose cell wall, chloroplasts and a permanent vacuole.",
        },
    isObjective ? 'name="answerKey"' : 'name="answerText"',
  );
  check("submitting an answer for marking", answered.status === 200, `${answered.status}`);

  const marked = await get(runPath);
  check(
    "the mark and its breakdown are shown",
    marked.status === 200 &&
      /Marked by AI|Checked by word matching|Marked automatically/.test(marked.body),
    `${marked.status}`,
  );
  check("  — with the mark scheme now revealed", marked.body.includes("The full mark scheme"));
  check(
    "  — and a way to say the mark is wrong",
    marked.body.includes("I think this mark is wrong"),
  );
  check(
    "  — and the standing disclaimer that it is not an examiner",
    marked.body.includes("not an examiner"),
  );

  // The API route, which the marking UI and any future client share.
  const api = await request("/api/ai/mark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      questionId: "bio-4112-q06",
      answerText:
        "Chloroplasts are the site of photosynthesis. Palisade cells get light; roots do not.",
      context: "PRACTICE",
    }),
  });
  const marking = await api.json().catch(() => ({}));
  check("POST /api/ai/mark", api.status === 200, `${api.status}`);
  check(
    "  — never awards more than the question is worth",
    typeof marking?.result?.awardedMarks === "number" &&
      marking.result.awardedMarks <= marking.result.maxMarks,
    `${marking?.result?.awardedMarks}/${marking?.result?.maxMarks}`,
  );
  check(
    "  — degrades to the deterministic marker with no API key",
    process.env.GEMINI_API_KEY
      ? marking?.result?.source === "AI"
      : marking?.result?.source === "AI_FALLBACK" && marking?.result?.provisional === true,
    `${marking?.result?.source}`,
  );

  const rejected = await request("/api/ai/mark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answerText: "no question id" }),
  });
  check("  — rejects a malformed request", rejected.status === 400, `${rejected.status}`);
}

console.log("\nBehind a reverse proxy");
{
  const publicHost = "3000-smoketest.e2b.app";

  const proxyHeaders = {
    host: "localhost:3000",
    "x-forwarded-host": publicHost,
    "x-forwarded-proto": "https",
  };
  const redirect = await fetch(new URL("/today", BASE), {
    redirect: "manual",
    headers: proxyHeaders,
  });
  const location = redirect.headers.get("location") ?? "";
  check(
    "protected routes redirect to the browser's own host",
    location === `https://${publicHost}/login?next=%2Ftoday`,
    location,
  );

  // The scheme has to survive a proxy that says nothing about it. Next fills in
  // `x-forwarded-proto: http` itself in that case — the hop into this server, not the
  // one the browser made — and an http:// redirect handed to an HTTPS page is blocked
  // as mixed content, which is indistinguishable from the app being down.
  const bare = await fetch(new URL("/today", BASE), {
    redirect: "manual",
    headers: { "x-forwarded-host": publicHost },
  });
  const bareLocation = bare.headers.get("location") ?? "";
  check(
    "no http:// redirect leaks when the proxy omits the scheme",
    bareLocation === `https://${publicHost}/login?next=%2Ftoday`,
    bareLocation,
  );

  // Loopback must stay on http, or local development breaks.
  const local = await fetch(new URL("/today", BASE), { redirect: "manual" });
  check(
    "  — but loopback stays on http",
    (local.headers.get("location") ?? "") === `${new URL(BASE).origin}/login?next=%2Ftoday`,
    local.headers.get("location") ?? "",
  );

  // A server action is a fetch expecting a Flight response. Redirecting it to the
  // login page hands React HTML it cannot parse, so the button just dies. The action
  // re-checks the session itself and answers in a format the client understands.
  const actionPage = await fetch(new URL("/onboarding/subjects", BASE), {
    redirect: "manual",
    headers: proxyHeaders,
  });
  check(
    "a signed-out server action is not redirected mid-flight",
    actionPage.status === 307,
    `page ${actionPage.status}`,
  );
  const signedOutAction = await fetch(new URL("/onboarding/subjects", BASE), {
    method: "POST",
    redirect: "manual",
    headers: { ...proxyHeaders, "next-action": "0123456789abcdef", accept: "text/x-component" },
    body: new URLSearchParams({ 0: "[]" }),
  });
  check(
    "  — it reaches the action instead of the login page",
    signedOutAction.status !== 307 ||
      (signedOutAction.headers.get("location") ?? "").startsWith("/login") === false,
    `${signedOutAction.status} → ${signedOutAction.headers.get("location") ?? "no redirect"}`,
  );

  // Origin is the public host, the server only knows its own: Next treats a mismatch
  // as CSRF and rejects the action unless the origin is explicitly allowed.
  jar.clear();
  const proxied = { origin: `https://${publicHost}` };
  const proxyEmail = `smoke.proxy.${Date.now()}@example.test`;
  const page = await get("/signup");
  const signUp = await submit(
    "/signup",
    page.body,
    { name: "Proxy", email: proxyEmail, password, dateOfBirth: "2009-05-17" },
    'name="dateOfBirth"',
    proxied,
  );
  check(
    "server actions work when Origin is the public host",
    redirected(signUp),
    `${signUp.status}`,
  );

  const subjects = await get("/onboarding/subjects");
  const saved = await submit(
    "/onboarding/subjects",
    subjects.body,
    { subjectId: ["aqa-biology", "aqa-chemistry"] },
    'name="subjectId"',
    proxied,
  );
  check("onboarding saves from behind the proxy", redirected(saved), `${saved.status}`);

  // The live preview renders the app in an iframe on another origin, so every request
  // from it is cross-site. Browsers withhold SameSite=Lax cookies there: the page still
  // paints, but the first server action is treated as signed out and bounces the student
  // back to the step they were on. SameSite=None is the only value that survives, and it
  // is ignored unless Secure rides along with it. Outside the sandbox, Lax must stay.
  jar.clear();
  const embedded = process.env.E2B_SANDBOX === "true";
  const cookiePage = await get("/signup");
  const cookieBody = new FormData();
  for (const [key, value] of Object.entries(
    actionFields(cookiePage.body, 'name="dateOfBirth"'),
  ))
    cookieBody.append(key, value);
  for (const [key, value] of Object.entries({
    name: "Cookie",
    email: `smoke.cookie.${Date.now()}@example.test`,
    password,
    dateOfBirth: "2009-05-17",
  }))
    cookieBody.append(key, value);

  const cookieResponse = await request("/signup", {
    method: "POST",
    body: cookieBody,
    headers: proxied,
  });
  const session =
    cookieResponse.headers.getSetCookie().find((c) => c.startsWith("authjs.session-token=")) ??
    "";
  const attributes = session.split(";").slice(1).join(";").trim() || "no session cookie";
  const crossSite = /;\s*Secure/i.test(session) && /;\s*SameSite=None/i.test(session);

  check(
    embedded
      ? "the session cookie is cross-site, so the iframe preview stays signed in"
      : "the session cookie stays SameSite=Lax outside the sandbox",
    embedded ? crossSite : /;\s*SameSite=Lax/i.test(session),
    attributes,
  );
}

console.log("\nPassword reset");
{
  jar.clear();
  const page = await get("/forgot-password");

  const unknown = await submit(
    "/forgot-password",
    page.body,
    { email: "nobody@example.test" },
    'name="email"',
  );
  check(
    "an unknown address gives nothing away",
    unknown.body.includes("If there&#x27;s an account"),
  );

  const real = await submit("/forgot-password", page.body, { email }, 'name="email"');
  const link =
    /https?:\/\/[^"\s]*?\/reset-password\?token=[A-Za-z0-9_-]+/.exec(real.body)?.[0] ??
    (await linkFromMailbox(email, "reset-password"));
  check("a reset link is produced", Boolean(link));

  if (link) {
    const url = new URL(link);
    const path = url.pathname + url.search;
    const token = url.searchParams.get("token");

    const form = await get(path);
    check("the reset form renders", form.body.includes("Choose a new password"));

    const mismatch = await submit(
      path,
      form.body,
      { token, password: "a-brand-new-passphrase", confirmPassword: "something-else" },
      'name="confirmPassword"',
    );
    check("a mismatched confirmation is refused", mismatch.body.includes("need to match"));

    const weak = await submit(
      path,
      form.body,
      { token, password: "qwerty12345", confirmPassword: "qwerty12345" },
      'name="confirmPassword"',
    );
    check("a weak new password is refused", weak.body.includes("commonly used"));

    const newPassword = "mitochondria-powerhouse-9";
    const done = await submit(
      path,
      form.body,
      { token, password: newPassword, confirmPassword: newPassword },
      'name="confirmPassword"',
    );
    check("the password is changed", redirected(done), `${done.status}`);

    const reuse = await get(path);
    check("the token cannot be reused", reuse.body.includes("already been used"));

    const login = await get("/login");
    const signedIn = await submit(
      "/login",
      login.body,
      { email, password: newPassword, next: "/today" },
      'name="password"',
    );
    check("the new password works", redirected(signedIn), `${signedIn.status}`);

    const today = await get("/today");
    check("and lands back on Today", today.body.includes("Your plan for today"));
  }
}

const failures = results.filter((result) => !result.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(` - ${failure.name} ${failure.detail}`);
  process.exit(1);
}

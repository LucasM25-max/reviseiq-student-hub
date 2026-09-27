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
function actionFields(html, needle) {
  const forms = html.split(/<form\b/).slice(1);
  const form =
    needle === null
      ? forms[0]
      : forms.find((candidate) =>
          candidate.slice(0, candidate.indexOf("</form>")).includes(needle),
        );

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

async function submit(path, html, values, needle = null) {
  const body = new FormData();
  for (const [key, value] of Object.entries(actionFields(html, needle)))
    body.append(key, value);
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => body.append(key, item));
    else body.append(key, value);
  }
  const response = await request(path, { method: "POST", body });
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
    ["/test", "Questions and marking"],
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

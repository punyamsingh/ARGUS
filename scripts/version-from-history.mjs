#!/usr/bin/env node
// Recomputes ARGUS's semantic version by replaying conventional-commit intent
// over the full git history. Breaking (`!` / BREAKING CHANGE) -> major,
// feat -> minor, fix/refactor/perf -> patch, docs/style/chore/ci/test -> no bump.
// Pre-1.0, so features bump the minor.
//
//   node scripts/version-from-history.mjs            # prints the version
//   node scripts/version-from-history.mjs --table    # prints the full ledger
import { execSync } from "node:child_process";

// One record per commit: subject, then body, delimited by control chars so a
// commit body can span multiple lines without confusing the parser.
const commits = execSync(
  "git log --reverse --no-merges --pretty=format:%s%x1f%b%x1e",
  { encoding: "utf8" },
)
  .split("\x1e")
  .map((rec) => rec.replace(/^\n/, ""))
  .filter(Boolean)
  .map((rec) => {
    const [subject, ...body] = rec.split("\x1f");
    return { subject, body: body.join("\x1f") };
  });

function classify(subject) {
  const s = subject.toLowerCase();
  if (s === "initial commit") return "chore";
  // Explicit conventional prefix wins if present.
  const m = s.match(/^(feat|fix|refactor|perf|docs|style|chore|ci|test|build)(\(|!|:)/);
  if (m) return m[1];
  // Otherwise infer from the prose.
  if (/readme|plan\.md|\bdocument\b|cold-start guide/.test(s)) return "docs";
  if (/\.env\.example|logging to ping/.test(s)) return "chore";
  if (/\bfix\b|fixes|429|403|sanitize|backoff|strip|failures in logs|returning nothing|double the/.test(s))
    return "fix";
  if (/redesign|refactor/.test(s)) return "refactor";
  if (/uppercase|wordmark/.test(s)) return "style";
  if (/^(add|scaffold|adopt|switch|expand|surface|end-to-end)\b/.test(s)) return "feat";
  return "chore";
}

// A commit is breaking if its type carries a `!` (e.g. feat!: / fix(scope)!:)
// or its body declares a BREAKING CHANGE footer — matching semantic-release.
function isBreaking({ subject, body }) {
  return /^[a-z]+(\([^)]*\))?!:/i.test(subject) || /BREAKING[ -]CHANGE/.test(`${subject}\n${body}`);
}

let major = 0, minor = 0, patch = 0;
const rows = [];
for (const commit of commits) {
  const { subject } = commit;
  const type = classify(subject);
  let bump = "—";
  if (isBreaking(commit)) { major++; minor = 0; patch = 0; bump = "major"; }
  else if (type === "feat") { minor++; patch = 0; bump = "minor"; }
  else if (["fix", "refactor", "perf"].includes(type)) { patch++; bump = "patch"; }
  rows.push({ version: `${major}.${minor}.${patch}`, type, bump, subject });
}

const version = `${major}.${minor}.${patch}`;
if (process.argv.includes("--table")) {
  for (const r of rows)
    console.log(`${r.version.padEnd(9)} ${r.type.padEnd(9)} ${r.bump.padEnd(6)} ${r.subject}`);
  console.log(`\nVersion: ${version}`);
} else {
  process.stdout.write(version);
}

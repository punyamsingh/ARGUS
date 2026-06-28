#!/usr/bin/env node
// Recomputes ARGUS's semantic version by replaying conventional-commit intent
// over the full git history. feat -> minor, fix/refactor/perf -> patch,
// docs/style/chore/ci/test -> no bump. Pre-1.0, so features bump the minor.
//
//   node scripts/version-from-history.mjs            # prints the version
//   node scripts/version-from-history.mjs --table    # prints the full ledger
import { execSync } from "node:child_process";

const subjects = execSync('git log --reverse --no-merges --pretty=format:%s', {
  encoding: "utf8",
}).trim().split("\n");

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

let major = 0, minor = 0, patch = 0;
const rows = [];
for (const subject of subjects) {
  const type = classify(subject);
  let bump = "—";
  if (type === "feat") { minor++; patch = 0; bump = "minor"; }
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

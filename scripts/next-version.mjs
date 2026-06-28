#!/usr/bin/env node
// Computes the next semantic version from a conventional-commit subject
// (typically the merged PR title) and the current package.json version.
//
//   feat            -> minor bump   (pre-1.0: 0.18.3 -> 0.19.0)
//   fix|refactor|perf -> patch bump (0.18.3 -> 0.18.4)
//   feat!/BREAKING  -> minor bump while pre-1.0, major bump once >= 1.0.0
//   docs|style|chore|ci|test|build -> no release
//
// Usage:
//   node scripts/next-version.mjs "<commit/PR title>"
// Prints the next version, or an empty string when no release is warranted.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// feat -> minor, fix/refactor/perf -> patch. Any other type (docs, style,
// chore, ci, test, build, revert) maps to undefined and cuts no release.
const RELEASE_BUMPS = { feat: "minor", fix: "patch", refactor: "patch", perf: "patch" };

export function parseType(title) {
  const m = /^(\w+)(\([^)]*\))?(!)?:/.exec(title.trim());
  if (!m) return null;
  return { type: m[1].toLowerCase(), breaking: Boolean(m[3]) || /BREAKING CHANGE/.test(title) };
}

export function nextVersion(current, title) {
  const parsed = parseType(title);
  if (!parsed) return null;
  const { type, breaking } = parsed;

  let [major, minor, patch] = current.split(".").map(Number);

  if (breaking) {
    // Stay in 0.x while pre-1.0 (breaking changes are expected); bump major after.
    if (major === 0) { minor += 1; patch = 0; }
    else { major += 1; minor = 0; patch = 0; }
    return `${major}.${minor}.${patch}`;
  }

  const bump = RELEASE_BUMPS[type];
  if (!bump) return null; // docs/chore/etc. -> no release
  if (bump === "minor") { minor += 1; patch = 0; }
  else { patch += 1; }
  return `${major}.${minor}.${patch}`;
}

// CLI entrypoint.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const title = process.argv[2] ?? "";
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const current = JSON.parse(readFileSync(pkgPath, "utf8")).version;
  const next = nextVersion(current, title);
  process.stdout.write(next ?? "");
}

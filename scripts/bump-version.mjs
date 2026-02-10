#!/usr/bin/env node

/**
 * Version bump script for SimplyTerm
 *
 * Syncs version across: tauri.conf.json (source of truth), Cargo.toml, package.json
 *
 * Usage:
 *   node scripts/bump-version.mjs <version>
 *   node scripts/bump-version.mjs patch|minor|major
 *   node scripts/bump-version.mjs 0.3.0-beta
 *
 * Examples:
 *   node scripts/bump-version.mjs patch         # 0.2.1-alpha -> 0.2.2
 *   node scripts/bump-version.mjs minor         # 0.2.1-alpha -> 0.3.0
 *   node scripts/bump-version.mjs major         # 0.2.1-alpha -> 1.0.0
 *   node scripts/bump-version.mjs 0.3.0-alpha   # explicit version
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const FILES = {
  tauri: resolve(ROOT, "src-tauri/tauri.conf.json"),
  cargo: resolve(ROOT, "src-tauri/Cargo.toml"),
  package: resolve(ROOT, "package.json"),
};

function getCurrentVersion() {
  const tauri = JSON.parse(readFileSync(FILES.tauri, "utf-8"));
  return tauri.version;
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return {
    major: Number.parseInt(match[1]),
    minor: Number.parseInt(match[2]),
    patch: Number.parseInt(match[3]),
    prerelease: match[4] || null,
  };
}

function formatVersion({ major, minor, patch, prerelease }) {
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

function bumpVersion(current, bump) {
  const v = parseVersion(current);

  switch (bump) {
    case "patch":
      return formatVersion({ ...v, patch: v.patch + 1, prerelease: null });
    case "minor":
      return formatVersion({ ...v, minor: v.minor + 1, patch: 0, prerelease: null });
    case "major":
      return formatVersion({ ...v, major: v.major + 1, minor: 0, patch: 0, prerelease: null });
    default:
      // Validate explicit version
      parseVersion(bump);
      return bump;
  }
}

function updateTauriConf(version) {
  const content = JSON.parse(readFileSync(FILES.tauri, "utf-8"));
  content.version = version;
  writeFileSync(FILES.tauri, JSON.stringify(content, null, 2) + "\n");
}

function updateCargoToml(version) {
  let content = readFileSync(FILES.cargo, "utf-8");
  content = content.replace(
    /^version = ".*"$/m,
    `version = "${version}"`
  );
  writeFileSync(FILES.cargo, content);
}

function updatePackageJson(version) {
  const content = JSON.parse(readFileSync(FILES.package, "utf-8"));
  content.version = version;
  writeFileSync(FILES.package, JSON.stringify(content, null, 2) + "\n");
}

// --- Main ---
const arg = process.argv[2];

if (!arg) {
  const current = getCurrentVersion();
  console.log(`Current version: ${current}`);
  console.log("");
  console.log("Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z[-pre]>");
  console.log("");
  console.log("Examples:");
  console.log(`  patch         → ${bumpVersion(current, "patch")}`);
  console.log(`  minor         → ${bumpVersion(current, "minor")}`);
  console.log(`  major         → ${bumpVersion(current, "major")}`);
  console.log(`  0.3.0-alpha   → 0.3.0-alpha`);
  process.exit(0);
}

const current = getCurrentVersion();
const newVersion = bumpVersion(current, arg);

console.log(`Bumping version: ${current} → ${newVersion}`);
console.log("");

updateTauriConf(newVersion);
console.log(`  ✓ src-tauri/tauri.conf.json`);

updateCargoToml(newVersion);
console.log(`  ✓ src-tauri/Cargo.toml`);

updatePackageJson(newVersion);
console.log(`  ✓ package.json`);

console.log("");
console.log(`Done! Version is now ${newVersion}`);

#!/usr/bin/env node
/**
 * Release von platform-client (README, „Releases“). Die Werkzeuge installieren das Paket per Git-Tag, ohne es zu bauen; deshalb
 * enthält jeder Tag das gebaute `dist/`, `main` aber nie:
 *
 *   main:  … ── Release 1.2.0 (Version, Changelog)
 *                     └── Build 1.2.0 (dazu dist/)   ← Tag v1.2.0
 *
 *   node scripts/release.mjs patch | minor | major
 *
 * Ablauf: sauberer Arbeitsbaum auf main, Einträge unter „## [Unreleased]“, Typprüfung, Lint und Tests grün → Commit „Release x.y.z“
 * auf main → Build → Commit mit dist/ neben main → Tag → zurück auf main. Veröffentlichen: `git push origin main vX.Y.Z`.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { release, today, unreleased } from './changelog.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Nächste Version nach Semantic Versioning */
export function nextVersion(current, bump) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!m) throw new Error(`Ungültige Version „${current}“ in package.json (erwartet: MAJOR.MINOR.PATCH).`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error('Aufruf: node scripts/release.mjs patch | minor | major');
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
// npm über die Shell (unter Windows ist npm ein Skript); die Befehle sind fest, keine Eingaben von außen
const npm = (command) => execSync(`npm ${command}`, { cwd: ROOT, stdio: 'inherit' });

function writeVersion(file, version, apply) {
  if (!existsSync(file)) return;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  apply(data, version);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function main(bump) {
  if (git('status', '--porcelain') !== '') throw new Error('Der Arbeitsbaum ist nicht sauber – erst alles committen.');
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') throw new Error('Releases entstehen nur auf main.');

  const pkgFile = join(ROOT, 'package.json');
  const lockFile = join(ROOT, 'package-lock.json');
  const changelogFile = join(ROOT, 'CHANGELOG.md');
  const version = nextVersion(JSON.parse(readFileSync(pkgFile, 'utf8')).version, bump);
  const tag = `v${version}`;
  if (git('tag', '--list', tag) !== '') throw new Error(`Den Tag ${tag} gibt es schon.`);
  const changelog = readFileSync(changelogFile, 'utf8');
  if (unreleased(changelog) === '') throw new Error('CHANGELOG.md: Unter „## [Unreleased]“ steht nichts – trage zuerst ein, was die neue Version enthält.');

  npm('run typecheck');
  npm('run lint');
  npm('test');

  // 1. Release-Commit auf main: Version und Changelog
  writeVersion(pkgFile, version, (d, v) => (d.version = v));
  writeVersion(lockFile, version, (d, v) => {
    d.version = v;
    if (d.packages?.['']) d.packages[''].version = v;
  });
  writeFileSync(changelogFile, release(changelog, version, today()));
  git('add', 'package.json', 'CHANGELOG.md', ...(existsSync(lockFile) ? ['package-lock.json'] : []));
  git('commit', '-m', `Release ${version}`);

  // 2. Build-Commit neben main mit dist/, darauf der Tag
  npm('run build');
  git('checkout', '--detach');
  try {
    git('add', '--force', 'dist');
    git('commit', '-m', `Build ${version} (dist für die Installation per Git-Tag)`);
    git('tag', '-a', tag, '-m', `Release ${version}`);
  } finally {
    git('checkout', 'main');
  }
  console.log(`\nRelease ${version} angelegt (Commit „Release ${version}“ auf main, Tag ${tag} mit dist/).`);
  console.log(`Veröffentlichen mit: git push origin main ${tag}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv[2]);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

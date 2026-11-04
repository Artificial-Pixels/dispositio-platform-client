#!/usr/bin/env node
/**
 * Changelog und Version (siehe RELEASING.md), aufgerufen von `npm version` über die Skripte im Wurzel-package.json:
 *
 *   node scripts/changelog.mjs check     prüft, dass unter „## [Unreleased]“ etwas steht (preversion)
 *   node scripts/changelog.mjs release   macht daraus die neue Version mit heutigem Datum (version; die Version setzt npm in
 *                                        `npm_package_version`, sonst aus package.json)
 *   node scripts/changelog.mjs done      Hinweis zum Veröffentlichen (postversion)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HEAD = '## [Unreleased]';
const VERSION_HEAD = /^## \[/m;

/** Lage des Abschnitts „## [Unreleased]“: Anfang der Überschrift, Ende der Überschrift, Anfang der nächsten Version (oder Textende) */
function section(text) {
  const start = text.indexOf(HEAD);
  if (start < 0) throw new Error('CHANGELOG.md: Der Abschnitt „## [Unreleased]“ fehlt.');
  const bodyStart = start + HEAD.length;
  const next = text.slice(bodyStart).search(VERSION_HEAD);
  return { start, bodyStart, end: next < 0 ? text.length : bodyStart + next };
}

/** Einträge unter „## [Unreleased]“ (ohne Leerzeilen am Rand); leer, wenn noch nichts eingetragen ist */
export function unreleased(text) {
  const s = section(text.replace(/\r\n/g, '\n'));
  return text.replace(/\r\n/g, '\n').slice(s.bodyStart, s.end).trim();
}

/**
 * Macht aus „## [Unreleased]“ die Version `version` vom `date` (JJJJ-MM-TT) und legt darüber ein leeres „## [Unreleased]“ an.
 * Zeilenenden bleiben, wie sie sind.
 */
export function release(text, version, date) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Ungültige Version „${version}“ (erwartet: MAJOR.MINOR.PATCH).`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Ungültiges Datum „${date}“ (erwartet: JJJJ-MM-TT).`);
  const crlf = text.includes('\r\n');
  const t = text.replace(/\r\n/g, '\n');
  if (t.includes(`## [${version}]`)) throw new Error(`CHANGELOG.md: Die Version ${version} steht schon im Changelog.`);
  const s = section(t);
  const body = t.slice(s.bodyStart, s.end).trim();
  if (body === '') throw new Error('CHANGELOG.md: Unter „## [Unreleased]“ steht nichts – trage zuerst ein, was die neue Version enthält.');
  const rest = t.slice(s.end);
  const out = `${t.slice(0, s.start)}${HEAD}\n\n## [${version}] - ${date}\n\n${body}\n${rest ? `\n${rest}` : ''}`;
  return crlf ? out.replace(/\n/g, '\r\n') : out;
}

/** Heutiges Datum (Ortszeit) als JJJJ-MM-TT */
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function main(command) {
  const changelog = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));
  const text = readFileSync(changelog, 'utf8');
  if (command === 'check') {
    if (unreleased(text) === '') throw new Error('CHANGELOG.md: Unter „## [Unreleased]“ steht nichts – trage zuerst ein, was die neue Version enthält.');
    console.log('CHANGELOG.md: Einträge unter „## [Unreleased]“ vorhanden.');
    return;
  }
  const version = process.env.npm_package_version ?? JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  if (command === 'release') {
    const date = today();
    writeFileSync(changelog, release(text, version, date));
    console.log(`CHANGELOG.md: „## [Unreleased]“ ist jetzt Version ${version} vom ${date}.`);
    return;
  }
  if (command === 'done') {
    console.log(`\nRelease ${version} angelegt (Commit „Release ${version}“, Tag v${version}). Veröffentlichen mit: git push --follow-tags\n`);
    return;
  }
  throw new Error('Aufruf: node scripts/changelog.mjs check | release | done');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv[2]);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

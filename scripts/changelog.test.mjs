import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { release, today, unreleased } from './changelog.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  'Einleitung.',
  '',
  '## [Unreleased]',
  '',
  '### Hinzugefügt',
  '',
  '- Neue Fußzeile.',
  '',
  '### Behoben',
  '',
  '- Ein Fehler.',
  '',
  '## [0.1.0] - 2026-10-21',
  '',
  'Erste Beta.',
  '',
].join('\n');

describe('Changelog beim Release', () => {
  it('liest die Einträge unter „## [Unreleased]“ bis zur nächsten Version', () => {
    expect(unreleased(CHANGELOG)).toBe('### Hinzugefügt\n\n- Neue Fußzeile.\n\n### Behoben\n\n- Ein Fehler.');
    expect(unreleased('# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-21\n\nErste Beta.\n')).toBe('');
    expect(() => unreleased('# Changelog\n')).toThrow('fehlt');
  });

  it('macht aus „## [Unreleased]“ die neue Version mit Datum und legt darüber ein leeres an', () => {
    expect(release(CHANGELOG, '0.2.0', '2026-11-02')).toBe(
      [
        '# Changelog',
        '',
        'Einleitung.',
        '',
        '## [Unreleased]',
        '',
        '## [0.2.0] - 2026-11-02',
        '',
        '### Hinzugefügt',
        '',
        '- Neue Fußzeile.',
        '',
        '### Behoben',
        '',
        '- Ein Fehler.',
        '',
        '## [0.1.0] - 2026-10-21',
        '',
        'Erste Beta.',
        '',
      ].join('\n'),
    );
  });

  it('auch ohne ältere Version und mit Windows-Zeilenenden', () => {
    expect(release('# Changelog\n\n## [Unreleased]\n\n- A\n', '1.0.0', '2027-01-01')).toBe('# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2027-01-01\n\n- A\n');
    expect(release(CHANGELOG.replace(/\n/g, '\r\n'), '0.2.0', '2026-11-02')).toBe(release(CHANGELOG, '0.2.0', '2026-11-02').replace(/\n/g, '\r\n'));
  });

  it('bricht ab: nichts eingetragen, Version schon vorhanden, ungültige Version oder ungültiges Datum', () => {
    expect(() => release('# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-21\n', '0.2.0', '2026-11-02')).toThrow('steht nichts');
    expect(() => release(CHANGELOG, '0.1.0', '2026-11-02')).toThrow('schon');
    expect(() => release(CHANGELOG, 'v0.2', '2026-11-02')).toThrow('Ungültige Version');
    expect(() => release(CHANGELOG, '0.2.0', '2.11.2026')).toThrow('Ungültiges Datum');
  });

  it('heutiges Datum als JJJJ-MM-TT', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('Veröffentlichte Versionen im Changelog', () => {
  // Neue Einträge gehören unter „## [Unreleased]“: Der Abschnitt einer Version, zu der es schon einen Tag gibt, muss so bleiben, wie er
  // beim Release war (sonst stünden in den Release-Notizen Dinge, die gar nicht ausgeliefert wurden). Ohne Tags (flacher Checkout in
  // der CI) gibt es nichts zu vergleichen.
  it('jede getaggte Version steht unverändert so da wie beim Release', () => {
    const git = (args, input) => {
      try {
        return execFileSync('git', args, { input, stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
      } catch {
        return null;
      }
    };
    const tags = (git(['tag', '--list', 'v*'])?.toString('utf8') ?? '').split('\n').filter(Boolean);
    // alle Stände in einem Aufruf: ein git-Prozess je Tag dauert unter Last (ganze Suite, Windows) länger als die Zeitgrenze
    const shown = new Map();
    const batch = tags.length ? git(['cat-file', '--batch'], tags.map((tag) => `${tag}:CHANGELOG.md\n`).join('')) : null;
    for (let at = 0, i = 0; batch && i < tags.length; i++) {
      const eol = batch.indexOf(0x0a, at);
      const header = batch.toString('utf8', at, eol).split(' ');
      at = eol + 1;
      if (header[1] === 'missing') continue; // Tag ohne CHANGELOG.md
      const size = Number(header[2]);
      shown.set(tags[i], batch.toString('utf8', at, at + size));
      at += size + 1;
    }
    const sectionOf = (text, version) => {
      const t = text.replace(/\r\n/g, '\n');
      const a = t.indexOf(`## [${version}]`);
      if (a < 0) return null;
      const b = t.indexOf('\n## [', a + 1);
      return t.slice(a, b < 0 ? undefined : b);
    };
    const now = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    for (const tag of tags) {
      const then = shown.get(tag);
      const released = then && sectionOf(then, tag.slice(1));
      if (!released) continue; // ältere Tags ohne eigenen Abschnitt
      expect(sectionOf(now, tag.slice(1)), tag).toBe(released);
    }
  });
});

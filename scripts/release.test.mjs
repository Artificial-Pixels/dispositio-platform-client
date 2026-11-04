import { describe, expect, it } from 'vitest';
import { nextVersion } from './release.mjs';

describe('nächste Version', () => {
  it('erhöht die gewählte Stelle und setzt die kleineren zurück', () => {
    expect(nextVersion('0.1.0', 'patch')).toBe('0.1.1');
    expect(nextVersion('0.1.3', 'minor')).toBe('0.2.0');
    expect(nextVersion('0.9.4', 'major')).toBe('1.0.0');
    expect(nextVersion('1.9.9', 'minor')).toBe('1.10.0');
  });

  it('bricht ab bei ungültiger Version oder unbekannter Stelle', () => {
    expect(() => nextVersion('1.0', 'patch')).toThrow(/Ungültige Version/);
    expect(() => nextVersion('1.0.0-beta.1', 'patch')).toThrow(/Ungültige Version/);
    expect(() => nextVersion('1.0.0', 'gross')).toThrow(/Aufruf/);
  });
});

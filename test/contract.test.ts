import { describe, expect, it } from 'vitest';
import { PRODUCT_KEYS, accessSchema, internalSessionSchema, internalUserPath, userSummarySchema } from '../src/contract/index.js';

const session = {
  user: { id: '6f1c2c1e-8a8e-4a57-9a3e-2f0c9a0b7d11', displayName: 'Anna', avatarUrl: 'https://dispositio.app/api/avatar/x?v=1', locale: 'de' },
  csrfToken: 'a'.repeat(43),
  access: {
    novelist: { status: 'active', source: 'beta', endsAt: null },
    quest: { status: 'none' },
  },
  products: [
    { key: 'novelist', name: 'Dispositio Novelist', url: 'https://novelist.dispositio.app', status: 'live' },
    { key: 'quest', name: 'Dispositio Quest', url: null, status: 'soon' },
  ],
  sessionExpiresAt: '2026-11-18T10:00:00.000Z',
};

describe('Vertrag: GET /internal/session', () => {
  it('nimmt die Antwort der Plattform an', () => {
    expect(internalSessionSchema.parse(session)).toEqual(session);
  });

  it('jedes Werkzeug muss im Zugang stehen', () => {
    expect(Object.keys(internalSessionSchema.shape.access.shape).sort()).toEqual([...PRODUCT_KEYS].sort());
    const { quest: _quest, ...onlyNovelist } = session.access;
    expect(internalSessionSchema.safeParse({ ...session, access: onlyNovelist }).success).toBe(false);
  });

  it('die E-Mail-Adresse gehört nicht zum Nutzer der Werkzeuge', () => {
    const parsed = internalSessionSchema.parse({ ...session, user: { ...session.user, email: 'anna@example.test' } });
    expect(parsed.user).not.toHaveProperty('email');
  });

  it('lehnt ungültige Werte ab', () => {
    expect(internalSessionSchema.safeParse({ ...session, user: { ...session.user, id: 'keine-uuid' } }).success).toBe(false);
    expect(internalSessionSchema.safeParse({ ...session, csrfToken: 'kurz' }).success).toBe(false);
    expect(internalSessionSchema.safeParse({ ...session, sessionExpiresAt: 'morgen' }).success).toBe(false);
  });
});

describe('Vertrag: Zugang', () => {
  it('drei Zustände mit ihren Angaben', () => {
    expect(accessSchema.parse({ status: 'active', source: 'manual', endsAt: '2026-12-01T00:00:00Z' })).toMatchObject({ status: 'active' });
    expect(accessSchema.parse({ status: 'expired', endedAt: '2026-10-01T00:00:00Z' })).toMatchObject({ status: 'expired' });
    expect(accessSchema.parse({ status: 'none' })).toEqual({ status: 'none' });
  });

  it('aktiver Zugang braucht eine bekannte Quelle, abgelaufener ein Datum', () => {
    expect(accessSchema.safeParse({ status: 'active', source: 'geschenkt', endsAt: null }).success).toBe(false);
    expect(accessSchema.safeParse({ status: 'expired' }).success).toBe(false);
  });
});

describe('Vertrag: Endpunkte der Werkzeuge', () => {
  it('Pfad zum Löschen eines Nutzers', () => {
    expect(internalUserPath('6f1c2c1e-8a8e-4a57-9a3e-2f0c9a0b7d11')).toBe('/internal/users/6f1c2c1e-8a8e-4a57-9a3e-2f0c9a0b7d11');
    expect(internalUserPath('a/b')).toBe('/internal/users/a%2Fb');
  });

  it('Zusammenfassung eines Nutzers', () => {
    expect(userSummarySchema.parse({ projects: 2, words: 81234, lastActivityAt: null })).toEqual({ projects: 2, words: 81234, lastActivityAt: null });
    expect(userSummarySchema.safeParse({ projects: -1, words: 0, lastActivityAt: null }).success).toBe(false);
  });
});

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Access, InternalSession } from '../src/contract/index.js';
import { platformAuth, readCookie, registerPlatformInternalRoutes, TtlCache, userIdOf, type PlatformAuthOptions } from '../src/server/index.js';

const USER_ID = '6f1c2c1e-8a8e-4a57-9a3e-2f0c9a0b7d11';
const TOKEN = 'i'.repeat(40);
const CSRF = 'c'.repeat(32);

const session = (novelist: Access): InternalSession => ({
  user: { id: USER_ID, displayName: 'Anna', avatarUrl: null, locale: 'de' },
  csrfToken: CSRF,
  access: { novelist, quest: { status: 'none' } },
  products: [
    { key: 'novelist', name: 'Dispositio Novelist', url: 'https://novelist.dispositio.app', status: 'live' },
    { key: 'quest', name: 'Dispositio Quest', url: null, status: 'soon' },
  ],
  sessionExpiresAt: '2026-12-01T00:00:00.000Z',
});

/** Nachgebaute Plattform: Cookie-Wert → Sitzung */
function fakePlatform(sessions: Record<string, InternalSession | 'down' | 'broken'>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('http://platform:3100/internal/session');
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    const s = sessions[headers['x-session-token'] ?? ''];
    if (s === 'down') throw new TypeError('fetch failed');
    if (s === 'broken') return new Response(JSON.stringify({ user: 'kaputt' }), { status: 200 });
    if (!s) return new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 });
    return new Response(JSON.stringify(s), { status: 200 });
  });
}

let app: FastifyInstance;
async function tool(over: Partial<PlatformAuthOptions> = {}, fetchImpl = fakePlatform({})) {
  app = Fastify();
  await app.register(platformAuth, {
    product: 'novelist',
    platformUrl: 'http://platform:3100',
    internalToken: TOKEN,
    publicPlatformUrl: 'https://dispositio.app',
    cookieName: '__Secure-dp_session',
    publicUrl: 'https://novelist.dispositio.app',
    fetch: fetchImpl as unknown as typeof fetch,
    ...over,
  });
  app.get('/api/stories', async (req) => ({ user: userIdOf(req) }));
  app.post('/api/stories', async () => ({ ok: true }));
  app.get('/api/stories/:id/backup', { config: { platform: 'export' } }, async () => ({ zip: true }));
  app.get('/api/health', { config: { platform: 'public' } }, async (req) => ({ ok: true, user: req.platform?.user.id ?? null }));
  await app.ready();
  return fetchImpl;
}
afterEach(async () => {
  await app?.close();
});

const call = (method: string, url: string, cookie?: string, headers: Record<string, string> = {}) =>
  app.inject({ method: method as 'GET', url, headers: { ...(cookie ? { cookie: `andere=1; __Secure-dp_session=${cookie}` } : {}), host: 'novelist.dispositio.app', ...headers } });

describe('platformAuth: Sitzung und Zugang', () => {
  it('ohne Sitzung: 401 mit Weiterleitung zur Anmeldung, zurück zur Seite, von der die Anfrage kam', async () => {
    await tool();
    const res = await call('GET', '/api/stories', undefined, { referer: 'https://novelist.dispositio.app/p/42' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: 'unauthorized',
      message: 'Bitte melde dich an.',
      details: { redirect: `https://dispositio.app/konto/anmelden?weiter=${encodeURIComponent('https://novelist.dispositio.app/p/42')}` },
    });
    // fremder Referer zählt nicht
    const foreign = await call('GET', '/api/stories', undefined, { referer: 'https://evil.example/' });
    expect(foreign.json().details.redirect).toBe(`https://dispositio.app/konto/anmelden?weiter=${encodeURIComponent('https://novelist.dispositio.app/')}`);
  });

  it('mit Zugang: die Route bekommt die Nutzer-ID; /api/me liefert alles für die Oberfläche', async () => {
    await tool({}, fakePlatform({ t1: session({ status: 'active', source: 'beta', endsAt: null }) }));
    expect((await call('GET', '/api/stories', 't1')).json()).toEqual({ user: USER_ID });
    const me = (await call('GET', '/api/me', 't1')).json();
    expect(me).toMatchObject({ product: 'novelist', csrfToken: CSRF, access: { status: 'active' }, platformUrl: 'https://dispositio.app', dev: false });
    expect(me.products).toHaveLength(2);
  });

  it('abgelaufen: gesperrt bis auf Export-Routen; Weiterleitung zu „kein Zugang“', async () => {
    await tool({}, fakePlatform({ t1: session({ status: 'expired', endedAt: '2026-10-01T00:00:00.000Z' }) }));
    const locked = await call('GET', '/api/stories', 't1');
    expect(locked.statusCode).toBe(403);
    expect(locked.json()).toMatchObject({ code: 'forbidden', message: 'Dein Zugang ist abgelaufen.', details: { redirect: 'https://dispositio.app/konto/kein-zugang/novelist' } });
    expect((await call('GET', '/api/stories/1/backup', 't1')).statusCode).toBe(200);
    expect((await call('GET', '/api/me', 't1')).json().access.status).toBe('expired');
  });

  it('nie freigeschaltet: auch der Export ist zu', async () => {
    await tool({}, fakePlatform({ t1: session({ status: 'none' }) }));
    expect((await call('GET', '/api/stories', 't1')).statusCode).toBe(403);
    expect((await call('GET', '/api/stories/1/backup', 't1')).statusCode).toBe(403);
  });

  it('öffentliche Routen gehen immer – mit Sitzung, wenn es eine gibt', async () => {
    await tool({}, fakePlatform({ t1: session({ status: 'none' }) }));
    expect((await call('GET', '/api/health')).json()).toEqual({ ok: true, user: null });
    expect((await call('GET', '/api/health', 't1')).json()).toEqual({ ok: true, user: USER_ID });
  });

  it('Pfade außerhalb von /api bleiben unberührt (kein 401, sondern was die App sonst antwortet)', async () => {
    await tool();
    expect((await call('GET', '/missing')).statusCode).toBe(404);
  });
});

describe('platformAuth: CSRF und Origin', () => {
  it('schreibende Anfragen brauchen das CSRF-Token der Plattform-Sitzung', async () => {
    await tool({}, fakePlatform({ t1: session({ status: 'active', source: 'beta', endsAt: null }) }));
    expect((await call('POST', '/api/stories', 't1')).statusCode).toBe(403);
    expect((await call('POST', '/api/stories', 't1', { 'x-csrf-token': 'falsch' })).statusCode).toBe(403);
    expect((await call('POST', '/api/stories', 't1', { 'x-csrf-token': CSRF })).statusCode).toBe(200);
  });

  it('fremder Origin wird abgewiesen, der eigene Host ist erlaubt', async () => {
    await tool({}, fakePlatform({ t1: session({ status: 'active', source: 'beta', endsAt: null }) }));
    expect((await call('POST', '/api/stories', 't1', { 'x-csrf-token': CSRF, origin: 'https://evil.example' })).statusCode).toBe(403);
    expect((await call('POST', '/api/stories', 't1', { 'x-csrf-token': CSRF, origin: 'https://novelist.dispositio.app' })).statusCode).toBe(200);
  });
});

describe('platformAuth: Zwischenspeicher und Ausfälle', () => {
  it('fragt die Plattform je Sitzung höchstens einmal in der Minute; auch „keine Sitzung“ kurz', async () => {
    const f = await tool({}, fakePlatform({ t1: session({ status: 'active', source: 'beta', endsAt: null }) }));
    await call('GET', '/api/stories', 't1');
    await call('GET', '/api/stories', 't1');
    await call('GET', '/api/me', 't1');
    await call('GET', '/api/stories', 'unbekannt');
    await call('GET', '/api/stories', 'unbekannt');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('Plattform nicht erreichbar oder Antwort passt nicht zum Vertrag: 503, öffentliche Routen gehen weiter', async () => {
    await tool({}, fakePlatform({ down: 'down', broken: 'broken' }));
    expect((await call('GET', '/api/stories', 'down')).statusCode).toBe(503);
    expect((await call('GET', '/api/stories', 'broken')).statusCode).toBe(503);
    expect((await call('GET', '/api/health', 'down')).statusCode).toBe(200);
  });

  it('in Produktion kein Entwicklungsmodus: ohne Plattform-Adresse Fehler beim Start', async () => {
    app = Fastify();
    await expect(
      app.register(platformAuth, { product: 'novelist', publicPlatformUrl: 'https://dispositio.app', cookieName: 'x', allowDevMode: false }).ready(),
    ).rejects.toThrow(/Entwicklungsmodus/);
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prod = Fastify();
      await expect(prod.register(platformAuth, { product: 'novelist', publicPlatformUrl: 'https://dispositio.app', cookieName: 'x' }).ready()).rejects.toThrow(/Produktion/);
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  it('ohne internes Token mit Plattform-Adresse: Fehler beim Start', async () => {
    app = Fastify();
    await expect(app.register(platformAuth, { product: 'novelist', platformUrl: 'http://platform:3100', publicPlatformUrl: 'https://dispositio.app', cookieName: 'x' }).ready()).rejects.toThrow(/internalToken/);
  });
});

describe('platformAuth: Entwicklungsmodus (ohne Plattform)', () => {
  it('fester Testnutzer mit Zugang; einstellbar abgelaufen', async () => {
    await tool({ platformUrl: null, internalToken: null });
    const me = (await call('GET', '/api/me')).json();
    expect(me).toMatchObject({ dev: true, user: { displayName: 'Entwicklung' }, access: { status: 'active' } });
    expect((await call('GET', '/api/stories')).statusCode).toBe(200);
    expect((await call('POST', '/api/stories', undefined, { 'x-csrf-token': me.csrfToken })).statusCode).toBe(200);
    await app.close();
    await tool({ platformUrl: null, internalToken: null, devAccess: 'expired' });
    expect((await call('GET', '/api/stories')).statusCode).toBe(403);
    expect((await call('GET', '/api/stories/1/backup')).statusCode).toBe(200);
  });
});

describe('interne Routen für die Plattform', () => {
  const setup = async () => {
    app = Fastify();
    const deleted: string[] = [];
    registerPlatformInternalRoutes(app, {
      internalToken: TOKEN,
      deleteUser: async (id) => void deleted.push(id),
      summary: async () => ({ projects: 3, words: 81234, lastActivityAt: null }),
    });
    await app.ready();
    return deleted;
  };
  const auth = { authorization: `Bearer ${TOKEN}` };

  it('löschen und Zusammenfassung nur mit Token', async () => {
    const deleted = await setup();
    expect((await app.inject({ method: 'DELETE', url: `/internal/users/${USER_ID}` })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: `/internal/users/${USER_ID}`, headers: { authorization: 'Bearer falsch' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: `/internal/users/${USER_ID.toUpperCase()}`, headers: auth })).statusCode).toBe(204);
    expect(deleted).toEqual([USER_ID]);
    const summary = await app.inject({ method: 'GET', url: `/internal/users/${USER_ID}/summary`, headers: auth });
    expect(summary.json()).toEqual({ projects: 3, words: 81234, lastActivityAt: null });
  });

  it('über den Proxy (X-Forwarded-For) oder mit ungültiger ID: 404', async () => {
    await setup();
    expect((await app.inject({ method: 'DELETE', url: `/internal/users/${USER_ID}`, headers: { ...auth, 'x-forwarded-for': '1.2.3.4' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/internal/users/keine-id', headers: auth })).statusCode).toBe(404);
  });

  it('zu kurzes Token: Fehler beim Start', () => {
    expect(() => registerPlatformInternalRoutes(Fastify(), { internalToken: 'kurz', deleteUser: async () => {}, summary: async () => ({ projects: 0, words: 0, lastActivityAt: null }) })).toThrow(/32 Zeichen/);
  });
});

describe('Hilfen', () => {
  it('Cookie lesen', () => {
    expect(readCookie('a=1; __Secure-dp_session=abc%2Bdef; b=2', '__Secure-dp_session')).toBe('abc+def');
    expect(readCookie('a=1', 'x')).toBeNull();
    expect(readCookie(undefined, 'x')).toBeNull();
  });

  it('Zwischenspeicher: Ablauf und Obergrenze', () => {
    let now = 0;
    const c = new TtlCache<number>(2, () => now);
    c.set('a', 1, 100);
    c.set('b', 2, 100);
    c.set('c', 3, 100);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    now = 150;
    expect(c.get('b')).toBeUndefined();
  });
});

import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  INTERNAL_SESSION_PATH,
  internalSessionSchema,
  platformLinks,
  SESSION_TOKEN_HEADER,
  type Access,
  type InternalSession,
  type PlatformRedirectError,
  type PlatformUser,
  type ProductInfo,
  type ProductKey,
  type ToolMe,
} from '../contract/index.js';
import { TtlCache } from './cache.js';
import { readCookie } from './cookies.js';

/**
 * Wie eine API-Route geschützt ist (`config: { platform: … }` an der Route):
 *  - `access` (Standard): Sitzung und gültiger Zugang zum Werkzeug
 *  - `export`: Sitzung und Zugang – auch abgelaufener (Sperrseite mit Export)
 *  - `session`: nur Sitzung (z. B. /api/me)
 *  - `public`: nichts (z. B. Health-Check)
 */
export type RouteProtection = 'access' | 'export' | 'session' | 'public';

/** Sitzung, wie ein Werkzeug sie sieht */
export interface PlatformSession {
  user: PlatformUser;
  csrfToken: string;
  /** Zugang zu diesem Werkzeug */
  access: Access;
  allAccess: InternalSession['access'];
  products: ProductInfo[];
  expiresAt: Date;
  /** Entwicklungsmodus ohne Plattform */
  dev: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Sitzung der Plattform; null = nicht angemeldet (nur auf Routen mit `platform: 'public'` zu sehen) */
    platform: PlatformSession | null;
  }
  interface FastifyContextConfig {
    platform?: RouteProtection;
  }
}

export interface PlatformAuthOptions {
  /** dieses Werkzeug */
  product: ProductKey;
  /**
   * Adresse der Plattform im internen Netz, z. B. `http://platform:3100`. Ohne Angabe: Entwicklungsmodus mit festem Testnutzer –
   * niemand muss für die Arbeit am Werkzeug die Plattform starten.
   */
  platformUrl?: string | null;
  /** Geheimes Token des Werkzeugs für `/internal/*` (Pflicht mit `platformUrl`) */
  internalToken?: string | null;
  /** Öffentliche Adresse der Plattform für Weiterleitungen, z. B. `https://dispositio.app` */
  publicPlatformUrl: string;
  /** Name des Sitzungs-Cookies der Plattform (`__Secure-dp_session` im Betrieb, lokal `dp_session`) */
  cookieName: string;
  /** Öffentliche Adresse des Werkzeugs (Rückweg nach der Anmeldung); ohne: aus Host und Protokoll der Anfrage */
  publicUrl?: string | null;
  /** nur Pfade mit diesem Anfang schützen (Standard `/api/`) */
  apiPrefix?: string;
  /** Wie lange eine Antwort der Plattform gilt (Standard 60 s) */
  cacheTtlMs?: number;
  /** Weitere Origins für schreibende Anfragen (zusätzlich zum eigenen Host) */
  allowedOrigins?: string[];
  /** Entwicklungsmodus: Zugang des Testnutzers (Standard `active`), zum Ausprobieren von Sperrseite und Weiterleitung */
  devAccess?: Access['status'];
  /**
   * Entwicklungsmodus erlauben (Standard: nur, wenn NODE_ENV nicht `production` ist). Schutz vor einem Werkzeug im Betrieb, dem
   * versehentlich `platformUrl` fehlt – sonst wäre jeder als Testnutzer mit vollem Zugang angemeldet.
   */
  allowDevMode?: boolean;
  /** Ersetzt fetch (Tests) */
  fetch?: typeof fetch;
}

export const DEV_USER: PlatformUser = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Entwicklung', avatarUrl: null, locale: 'de' };
const DEV_CSRF = 'dev-csrf-token-0000000000000000';
const NEGATIVE_TTL_MS = 5_000;
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class PlatformUnavailableError extends Error {}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const safeEqual = (a: string, b: string): boolean => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

function devAccess(status: Access['status']): Access {
  if (status === 'expired') return { status: 'expired', endedAt: new Date(Date.now() - 86_400_000).toISOString() };
  if (status === 'none') return { status: 'none' };
  return { status: 'active', source: 'beta', endsAt: null };
}

/**
 * Anbindung eines Werkzeugs an die Plattform (PLAN.md §3, „Ein Werkzeug öffnen“). Registriert einen Hook für alle API-Routen:
 * Sitzung über die Plattform prüfen (zwischengespeichert), Zugang und CSRF-Token prüfen, bei Bedarf mit Weiterleitungsziel abweisen.
 * Dazu die Route `GET {apiPrefix}me` für die Oberfläche. Standardmäßig verschlossen: Jede Route ohne `config.platform` verlangt Zugang.
 */
export async function platformAuth(app: FastifyInstance, opts: PlatformAuthOptions): Promise<void> {
  const prefix = opts.apiPrefix ?? '/api/';
  const ttl = opts.cacheTtlMs ?? 60_000;
  const dev = !opts.platformUrl;
  if (dev && !(opts.allowDevMode ?? process.env.NODE_ENV !== 'production')) {
    throw new Error('platformAuth: platformUrl fehlt – in Produktion gibt es keinen Entwicklungsmodus (fester Testnutzer).');
  }
  if (!dev && !opts.internalToken) throw new Error('platformAuth: internalToken ist nötig, wenn platformUrl gesetzt ist.');
  const fetchImpl = opts.fetch ?? fetch;
  const cache = new TtlCache<InternalSession | null>();
  const links = platformLinks(opts.publicPlatformUrl, opts.product);

  const devSession = (): PlatformSession => ({
    user: DEV_USER,
    csrfToken: DEV_CSRF,
    access: devAccess(opts.devAccess ?? 'active'),
    allAccess: { novelist: devAccess(opts.devAccess ?? 'active'), quest: { status: 'none' } },
    products: [
      { key: 'novelist', name: 'Dispositio Novelist', url: null, status: 'live' },
      { key: 'quest', name: 'Dispositio Quest', url: null, status: 'soon' },
    ],
    expiresAt: new Date(Date.now() + 86_400_000),
    dev: true,
  });

  /** Sitzung zum Cookie: aus dem Zwischenspeicher oder von der Plattform; null = keine gültige */
  const fetchSession = async (token: string): Promise<InternalSession | null> => {
    const key = sha256(token);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let res: Response;
    try {
      res = await fetchImpl(`${opts.platformUrl!.replace(/\/+$/, '')}${INTERNAL_SESSION_PATH}`, {
        headers: { authorization: `Bearer ${opts.internalToken}`, [SESSION_TOKEN_HEADER]: token, accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      throw new PlatformUnavailableError((err as Error).message);
    }
    if (res.status === 401) {
      cache.set(key, null, NEGATIVE_TTL_MS);
      return null;
    }
    if (!res.ok) throw new PlatformUnavailableError(`Plattform antwortet mit ${res.status}`);
    const parsed = internalSessionSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new PlatformUnavailableError('Antwort der Plattform passt nicht zum Vertrag');
    cache.set(key, parsed.data, ttl);
    return parsed.data;
  };

  const resolve = async (req: FastifyRequest): Promise<PlatformSession | null> => {
    if (dev) return devSession();
    const token = readCookie(req.headers.cookie, opts.cookieName);
    if (!token || token.length > 200) return null;
    const s = await fetchSession(token);
    if (!s) return null;
    return { user: s.user, csrfToken: s.csrfToken, access: s.access[opts.product], allAccess: s.access, products: s.products, expiresAt: new Date(s.sessionExpiresAt), dev: false };
  };

  /** Adresse, zu der die Oberfläche nach der Anmeldung zurückkehrt: die Seite, von der die Anfrage kam (sonst die Startseite) */
  const returnTo = (req: FastifyRequest): string => {
    const own = opts.publicUrl?.replace(/\/+$/, '') ?? `${req.protocol}://${req.headers.host ?? 'localhost'}`;
    const referer = req.headers.referer;
    if (typeof referer === 'string' && referer.startsWith(`${own}/`)) return referer;
    return `${own}/`;
  };

  const deny = (reply: FastifyReply, status: 401 | 403, body: PlatformRedirectError) => reply.code(status).send(body);

  const originAllowed = (req: FastifyRequest): boolean => {
    const origin = req.headers.origin;
    if (!origin) return true; // Nicht-Browser-Clients senden keinen Origin
    try {
      const url = new URL(origin);
      return url.host === req.headers.host || (opts.allowedOrigins ?? []).includes(url.origin);
    } catch {
      return false;
    }
  };

  app.decorateRequest('platform', null);

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith(prefix)) return;
    const protection: RouteProtection = req.routeOptions.config?.platform ?? 'access';
    const unsafe = UNSAFE.has(req.method);
    if (unsafe && !originAllowed(req)) return reply.code(403).send({ code: 'csrf', message: 'Origin nicht erlaubt.' });

    let session: PlatformSession | null;
    try {
      session = await resolve(req);
    } catch (err) {
      if (!(err instanceof PlatformUnavailableError)) throw err;
      req.log.error({ err: { message: err.message } }, 'Plattform nicht erreichbar');
      if (protection === 'public') return;
      return reply.code(503).send({ code: 'internal', message: 'Die Anmeldung ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.' });
    }
    req.platform = session;
    if (protection === 'public') return;

    if (!session) {
      return deny(reply, 401, { code: 'unauthorized', message: 'Bitte melde dich an.', details: { redirect: links.login(returnTo(req)) } });
    }
    if (unsafe) {
      const header = req.headers['x-csrf-token'];
      if (typeof header !== 'string' || !safeEqual(header, session.csrfToken)) {
        return reply.code(403).send({ code: 'csrf', message: 'Ungültiges oder fehlendes CSRF-Token.' });
      }
    }
    if (protection === 'session') return;
    const ok = session.access.status === 'active' || (protection === 'export' && session.access.status === 'expired');
    if (!ok) {
      return deny(reply, 403, {
        code: 'forbidden',
        message: session.access.status === 'expired' ? 'Dein Zugang ist abgelaufen.' : 'Für dein Konto ist dieses Werkzeug nicht freigeschaltet.',
        details: { redirect: links.noAccess, access: session.access },
      });
    }
  });

  app.get(`${prefix}me`, { config: { platform: 'session' } }, async (req): Promise<ToolMe> => {
    const s = req.platform!;
    return { user: s.user, csrfToken: s.csrfToken, product: opts.product, access: s.access, products: s.products, platformUrl: opts.publicPlatformUrl, dev: s.dev };
  });
}

// wie fastify-plugin: Hook und Dekoration gelten für die ganze App, nicht nur in einem gekapselten Kontext
(platformAuth as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;

/** Sitzung einer Anfrage hinter `platformAuth` (Routen mit `access`, `export` oder `session` haben immer eine) */
export function sessionOf(req: FastifyRequest): PlatformSession {
  if (!req.platform) throw Object.assign(new Error('Keine Sitzung – Route mit platform: "public"?'), { statusCode: 401 });
  return req.platform;
}

/** Nutzer-ID der Anfrage – das Einzige, was ein Werkzeug vom Konto speichert */
export const userIdOf = (req: FastifyRequest): string => sessionOf(req).user.id;

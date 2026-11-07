import { createHash, timingSafeEqual } from 'node:crypto';
import { INTERNAL_SESSION_PATH, internalSessionSchema, platformLinks, SESSION_TOKEN_HEADER, } from '../contract/index.js';
import { TtlCache } from './cache.js';
import { readCookie } from './cookies.js';
const DEV_PRODUCT_NAMES = { novelist: 'Dispositio Novelist', quest: 'Dispositio Quest' };
export const DEV_USER = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Entwicklung', avatarUrl: null, locale: 'de' };
const DEV_CSRF = 'dev-csrf-token-0000000000000000';
const NEGATIVE_TTL_MS = 5_000;
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export class PlatformUnavailableError extends Error {
}
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const safeEqual = (a, b) => {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
};
function devAccess(status) {
    if (status === 'expired')
        return { status: 'expired', endedAt: new Date(Date.now() - 86_400_000).toISOString() };
    if (status === 'none')
        return { status: 'none' };
    return { status: 'active', source: 'beta', endsAt: null };
}
/**
 * Anbindung eines Werkzeugs an die Plattform (PLAN.md §3, „Ein Werkzeug öffnen“). Registriert einen Hook für alle API-Routen:
 * Sitzung über die Plattform prüfen (zwischengespeichert), Zugang und CSRF-Token prüfen, bei Bedarf mit Weiterleitungsziel abweisen.
 * Dazu die Route `GET {apiPrefix}me` für die Oberfläche. Standardmäßig verschlossen: Jede Route ohne `config.platform` verlangt Zugang.
 */
export async function platformAuth(app, opts) {
    const prefix = opts.apiPrefix ?? '/api/';
    const ttl = opts.cacheTtlMs ?? 60_000;
    const dev = !opts.platformUrl;
    if (dev && !(opts.allowDevMode ?? process.env.NODE_ENV !== 'production')) {
        throw new Error('platformAuth: platformUrl fehlt – in Produktion gibt es keinen Entwicklungsmodus (fester Testnutzer).');
    }
    if (!dev && !opts.internalToken)
        throw new Error('platformAuth: internalToken ist nötig, wenn platformUrl gesetzt ist.');
    const fetchImpl = opts.fetch ?? fetch;
    const cache = new TtlCache();
    const links = platformLinks(opts.publicPlatformUrl, opts.product);
    const devSession = () => ({
        user: DEV_USER,
        csrfToken: DEV_CSRF,
        access: devAccess(opts.devAccess ?? 'active'),
        allAccess: { novelist: { status: 'none' }, quest: { status: 'none' }, [opts.product]: devAccess(opts.devAccess ?? 'active') },
        // wie bei der Plattform: nur die Werkzeuge des Kontos – der Testnutzer hat nur dieses
        products: [{ key: opts.product, name: DEV_PRODUCT_NAMES[opts.product], url: null, status: 'live' }],
        expiresAt: new Date(Date.now() + 86_400_000),
        dev: true,
    });
    /** Sitzung zum Cookie: aus dem Zwischenspeicher oder von der Plattform; null = keine gültige */
    const fetchSession = async (token) => {
        const key = sha256(token);
        const cached = cache.get(key);
        if (cached !== undefined)
            return cached;
        let res;
        try {
            res = await fetchImpl(`${opts.platformUrl.replace(/\/+$/, '')}${INTERNAL_SESSION_PATH}`, {
                headers: { authorization: `Bearer ${opts.internalToken}`, [SESSION_TOKEN_HEADER]: token, accept: 'application/json' },
                signal: AbortSignal.timeout(5_000),
            });
        }
        catch (err) {
            throw new PlatformUnavailableError(err.message);
        }
        if (res.status === 401) {
            cache.set(key, null, NEGATIVE_TTL_MS);
            return null;
        }
        if (!res.ok)
            throw new PlatformUnavailableError(`Plattform antwortet mit ${res.status}`);
        const parsed = internalSessionSchema.safeParse(await res.json().catch(() => null));
        if (!parsed.success)
            throw new PlatformUnavailableError('Antwort der Plattform passt nicht zum Vertrag');
        cache.set(key, parsed.data, ttl);
        return parsed.data;
    };
    const resolve = async (req) => {
        if (dev)
            return devSession();
        const token = readCookie(req.headers.cookie, opts.cookieName);
        if (!token || token.length > 200)
            return null;
        const s = await fetchSession(token);
        if (!s)
            return null;
        return { user: s.user, csrfToken: s.csrfToken, access: s.access[opts.product], allAccess: s.access, products: s.products, expiresAt: new Date(s.sessionExpiresAt), dev: false };
    };
    /** Adresse, zu der die Oberfläche nach der Anmeldung zurückkehrt: die Seite, von der die Anfrage kam (sonst die Startseite) */
    const returnTo = (req) => {
        const own = opts.publicUrl?.replace(/\/+$/, '') ?? `${req.protocol}://${req.headers.host ?? 'localhost'}`;
        const referer = req.headers.referer;
        if (typeof referer === 'string' && referer.startsWith(`${own}/`))
            return referer;
        return `${own}/`;
    };
    const deny = (reply, status, body) => reply.code(status).send(body);
    const originAllowed = (req) => {
        const origin = req.headers.origin;
        if (!origin)
            return true; // Nicht-Browser-Clients senden keinen Origin
        try {
            const url = new URL(origin);
            return url.host === req.headers.host || (opts.allowedOrigins ?? []).includes(url.origin);
        }
        catch {
            return false;
        }
    };
    app.decorateRequest('platform', null);
    app.addHook('onRequest', async (req, reply) => {
        if (!req.url.startsWith(prefix))
            return;
        const protection = req.routeOptions.config?.platform ?? 'access';
        const unsafe = UNSAFE.has(req.method);
        if (unsafe && !originAllowed(req))
            return reply.code(403).send({ code: 'csrf', message: 'Origin nicht erlaubt.' });
        let session;
        try {
            session = await resolve(req);
        }
        catch (err) {
            if (!(err instanceof PlatformUnavailableError))
                throw err;
            req.log.error({ err: { message: err.message } }, 'Plattform nicht erreichbar');
            if (protection === 'public')
                return;
            return reply.code(503).send({ code: 'internal', message: 'Die Anmeldung ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.' });
        }
        req.platform = session;
        if (protection === 'public')
            return;
        if (!session) {
            return deny(reply, 401, { code: 'unauthorized', message: 'Bitte melde dich an.', details: { redirect: links.login(returnTo(req)) } });
        }
        if (unsafe) {
            const header = req.headers['x-csrf-token'];
            if (typeof header !== 'string' || !safeEqual(header, session.csrfToken)) {
                return reply.code(403).send({ code: 'csrf', message: 'Ungültiges oder fehlendes CSRF-Token.' });
            }
        }
        if (protection === 'session')
            return;
        const ok = session.access.status === 'active' || (protection === 'export' && session.access.status === 'expired');
        if (!ok) {
            return deny(reply, 403, {
                code: 'forbidden',
                message: session.access.status === 'expired' ? 'Dein Zugang ist abgelaufen.' : 'Für dein Konto ist dieses Werkzeug nicht freigeschaltet.',
                details: { redirect: links.noAccess, access: session.access },
            });
        }
    });
    app.get(`${prefix}me`, { config: { platform: 'session' } }, async (req) => {
        const s = req.platform;
        return { user: s.user, csrfToken: s.csrfToken, product: opts.product, access: s.access, products: s.products, platformUrl: opts.publicPlatformUrl, dev: s.dev };
    });
}
// wie fastify-plugin: Hook und Dekoration gelten für die ganze App, nicht nur in einem gekapselten Kontext
platformAuth[Symbol.for('skip-override')] = true;
/** Sitzung einer Anfrage hinter `platformAuth` (Routen mit `access`, `export` oder `session` haben immer eine) */
export function sessionOf(req) {
    if (!req.platform)
        throw Object.assign(new Error('Keine Sitzung – Route mit platform: "public"?'), { statusCode: 401 });
    return req.platform;
}
/** Nutzer-ID der Anfrage – das Einzige, was ein Werkzeug vom Konto speichert */
export const userIdOf = (req) => sessionOf(req).user.id;
//# sourceMappingURL=plugin.js.map
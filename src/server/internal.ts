import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { userSummarySchema, type UserSummary } from '../contract/index.js';

export interface InternalRoutesOptions {
  /** dasselbe geheime Token wie für `platformAuth` */
  internalToken: string;
  /** alle Daten des Nutzers in diesem Werkzeug löschen (Konto löschen, Aufbewahrung); doppelt aufrufbar */
  deleteUser: (userId: string) => Promise<void>;
  /** Anzahl Geschichten, Wörter, letzte Änderung */
  summary: (userId: string) => Promise<UserSummary>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Endpunkte, die die Plattform beim Werkzeug aufruft (PLAN.md §6): nur im internen Netz – Anfragen, die über den Proxy kamen
 * (`X-Forwarded-For`), werden abgewiesen, zusätzlich zur Sperre in Caddy – und nur mit dem geheimen Token.
 */
export function registerPlatformInternalRoutes(app: FastifyInstance, opts: InternalRoutesOptions): void {
  if (!opts.internalToken || opts.internalToken.length < 32) throw new Error('registerPlatformInternalRoutes: internalToken mit mindestens 32 Zeichen nötig.');
  const expected = Buffer.from(`Bearer ${opts.internalToken}`);

  const guard = (req: FastifyRequest, reply: FastifyReply): string | null => {
    if (req.headers['x-forwarded-for']) {
      void reply.code(404).send({ code: 'not_found', message: 'Nicht gefunden' });
      return null;
    }
    const given = Buffer.from(String(req.headers.authorization ?? ''));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      void reply.code(401).send({ code: 'unauthorized', message: 'Ungültiges Token.' });
      return null;
    }
    const { id } = req.params as { id: string };
    if (!UUID.test(id)) {
      void reply.code(404).send({ code: 'not_found', message: 'Nicht gefunden' });
      return null;
    }
    return id.toLowerCase();
  };

  app.delete('/internal/users/:id', { config: { platform: 'public' } }, async (req, reply) => {
    const id = guard(req, reply);
    if (!id) return reply;
    await opts.deleteUser(id);
    return reply.code(204).send();
  });

  app.get('/internal/users/:id/summary', { config: { platform: 'public' } }, async (req, reply) => {
    const id = guard(req, reply);
    if (!id) return reply;
    return userSummarySchema.parse(await opts.summary(id));
  });
}

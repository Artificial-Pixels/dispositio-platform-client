import type { FastifyInstance } from 'fastify';
import { type UserSummary } from '../contract/index.js';
export interface InternalRoutesOptions {
    /** dasselbe geheime Token wie für `platformAuth` */
    internalToken: string;
    /** alle Daten des Nutzers in diesem Werkzeug löschen (Konto löschen, Aufbewahrung); doppelt aufrufbar */
    deleteUser: (userId: string) => Promise<void>;
    /** Anzahl Geschichten, Wörter, letzte Änderung */
    summary: (userId: string) => Promise<UserSummary>;
}
/**
 * Endpunkte, die die Plattform beim Werkzeug aufruft (PLAN.md §6): nur im internen Netz – Anfragen, die über den Proxy kamen
 * (`X-Forwarded-For`), werden abgewiesen, zusätzlich zur Sperre in Caddy – und nur mit dem geheimen Token.
 */
export declare function registerPlatformInternalRoutes(app: FastifyInstance, opts: InternalRoutesOptions): void;
//# sourceMappingURL=internal.d.ts.map
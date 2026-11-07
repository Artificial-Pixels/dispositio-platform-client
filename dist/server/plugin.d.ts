import type { FastifyInstance, FastifyRequest } from 'fastify';
import { type Access, type InternalSession, type PlatformUser, type ProductInfo, type ProductKey } from '../contract/index.js';
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
export declare const DEV_USER: PlatformUser;
export declare class PlatformUnavailableError extends Error {
}
/**
 * Anbindung eines Werkzeugs an die Plattform (PLAN.md §3, „Ein Werkzeug öffnen“). Registriert einen Hook für alle API-Routen:
 * Sitzung über die Plattform prüfen (zwischengespeichert), Zugang und CSRF-Token prüfen, bei Bedarf mit Weiterleitungsziel abweisen.
 * Dazu die Route `GET {apiPrefix}me` für die Oberfläche. Standardmäßig verschlossen: Jede Route ohne `config.platform` verlangt Zugang.
 */
export declare function platformAuth(app: FastifyInstance, opts: PlatformAuthOptions): Promise<void>;
/** Sitzung einer Anfrage hinter `platformAuth` (Routen mit `access`, `export` oder `session` haben immer eine) */
export declare function sessionOf(req: FastifyRequest): PlatformSession;
/** Nutzer-ID der Anfrage – das Einzige, was ein Werkzeug vom Konto speichert */
export declare const userIdOf: (req: FastifyRequest) => string;
//# sourceMappingURL=plugin.d.ts.map
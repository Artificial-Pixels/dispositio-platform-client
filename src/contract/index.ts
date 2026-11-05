/**
 * Vertrag der internen Schnittstelle zwischen Plattform und Werkzeugen (dispositio-platform, PLAN.md §6). Beide Seiten prüfen ihre
 * Antworten in Vertragstests gegen diese Schemas. Eine Änderung, die ältere Werkzeuge bricht, bekommt eine neue Hauptversion.
 */
import { z } from 'zod';

/** Werkzeuge von Dispositio */
export const PRODUCT_KEYS = ['novelist', 'quest'] as const;
export const productKeySchema = z.enum(PRODUCT_KEYS);
export type ProductKey = z.infer<typeof productKeySchema>;

/** Woher eine Berechtigung stammt. `trial` und `paddle` kommen mit dem Verkauf (PLAN.md §10). */
export const ACCESS_SOURCES = ['beta', 'manual', 'trial', 'paddle'] as const;
export const accessSourceSchema = z.enum(ACCESS_SOURCES);
export type AccessSource = z.infer<typeof accessSourceSchema>;

/**
 * Zugang eines Nutzers zu einem Werkzeug, von der Plattform berechnet:
 *  - `active`: eine Berechtigung gilt (Ende `null` = offen)
 *  - `expired`: es gab eine, keine gilt mehr – das Werkzeug zeigt die Sperrseite mit Export
 *  - `none`: nie eine gehabt – das Werkzeug leitet zur Plattform
 */
export const accessSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('active'), source: accessSourceSchema, endsAt: z.iso.datetime().nullable() }),
  z.object({ status: z.literal('expired'), endedAt: z.iso.datetime() }),
  z.object({ status: z.literal('none') }),
]);
export type Access = z.infer<typeof accessSchema>;

/** Angemeldeter Nutzer, wie ihn die Werkzeuge sehen – ohne E-Mail-Adresse. */
export const platformUserSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  avatarUrl: z.url().nullable(),
  locale: z.string().min(2),
});
export type PlatformUser = z.infer<typeof platformUserSchema>;

/** Ein Werkzeug für Produktumschalter und Hinweise: Name, Adresse (null = hier nicht erreichbar), im Betrieb oder angekündigt */
export const productInfoSchema = z.object({
  key: productKeySchema,
  name: z.string().min(1),
  url: z.url().nullable(),
  status: z.enum(['live', 'soon']),
});
export type ProductInfo = z.infer<typeof productInfoSchema>;

/** Header mit dem Wert des Sitzungs-Cookies, den ein Werkzeug an `GET /internal/session` weiterreicht */
export const SESSION_TOKEN_HEADER = 'x-session-token';
export const INTERNAL_SESSION_PATH = '/internal/session';

/** Antwort von `GET /internal/session` (401 ohne gültige Sitzung, 403 bei falschem Werkzeug-Token). `access` nennt jedes Werkzeug. */
export const internalSessionSchema = z.object({
  user: platformUserSchema,
  csrfToken: z.string().min(16),
  access: z.object({ novelist: accessSchema, quest: accessSchema }),
  /**
   * Werkzeuge dieses Kontos für den Produktumschalter: das fragende und die, für die es Zugang gibt oder gab – nie eines ohne Zugang
   * (seit Plattform-Stand 05.11.2026; vorher alle Werkzeuge)
   */
  products: z.array(productInfoSchema),
  sessionExpiresAt: z.iso.datetime(),
});
export type InternalSession = z.infer<typeof internalSessionSchema>;

/** `DELETE /internal/users/:id` beim Werkzeug: alle Daten des Nutzers löschen; 204, auch wenn nichts da ist. */
export const internalUserPath = (userId: string): string => `/internal/users/${encodeURIComponent(userId)}`;

/** Antwort von `GET /internal/users/:id/summary` beim Werkzeug (Admin-Bereich, Auskunft, Aufräumen). */
export const userSummarySchema = z.object({
  projects: z.number().int().min(0),
  words: z.number().int().min(0),
  lastActivityAt: z.iso.datetime().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

// ---------------------------------------------------------------------------
// Werkzeug: eigener Server ↔ eigene Oberfläche (platform-client/server → platform-client/react)
// ---------------------------------------------------------------------------

/** Antwort von `GET /api/me` eines Werkzeugs */
export const toolMeSchema = z.object({
  user: platformUserSchema,
  csrfToken: z.string().min(16),
  /** dieses Werkzeug */
  product: productKeySchema,
  /** Zugang zu diesem Werkzeug */
  access: accessSchema,
  products: z.array(productInfoSchema),
  /** öffentliche Adresse der Plattform, z. B. https://dispositio.app */
  platformUrl: z.url(),
  /** Entwicklungsmodus ohne Plattform (fester Testnutzer) */
  dev: z.boolean(),
});
export type ToolMe = z.infer<typeof toolMeSchema>;

/** Fehler der Werkzeug-API, wenn Sitzung oder Zugang fehlen: wohin die Oberfläche weiterleitet */
export interface PlatformRedirectError {
  code: 'unauthorized' | 'forbidden';
  message: string;
  details: { redirect: string; access?: Access };
}

/** Adressen der Plattform, die Werkzeuge verlinken (Seiten der Konto-App) */
export const platformLinks = (platformUrl: string, product: ProductKey) => {
  const base = platformUrl.replace(/\/+$/, '');
  return {
    account: `${base}/konto`,
    profile: `${base}/konto/profil`,
    security: `${base}/konto/sicherheit`,
    /** nach dem Anmelden zurück zu `returnTo` (die Plattform lässt nur bekannte Werkzeuge zu) */
    login: (returnTo: string) => `${base}/konto/anmelden?weiter=${encodeURIComponent(returnTo)}`,
    /** abmelden – überall, denn die Sitzung gehört der Plattform; danach zur Anmeldung mit Rückweg */
    logout: (returnTo: string) => `${base}/konto/abmelden?weiter=${encodeURIComponent(returnTo)}`,
    noAccess: `${base}/konto/kein-zugang/${product}`,
  };
};

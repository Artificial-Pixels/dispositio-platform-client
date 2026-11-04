/**
 * Vertrag der internen Schnittstelle zwischen Plattform und Werkzeugen (dispositio-platform, PLAN.md §6). Beide Seiten prüfen ihre
 * Antworten in Vertragstests gegen diese Schemas. Eine Änderung, die ältere Werkzeuge bricht, bekommt eine neue Hauptversion.
 */
import { z } from 'zod';

/** Werkzeuge von Dispositio; die Plattform hat zu jedem Name, Adresse und Status (packages/shared/src/products.ts). */
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

/** Header mit dem Wert des Sitzungs-Cookies, den ein Werkzeug an `GET /internal/session` weiterreicht */
export const SESSION_TOKEN_HEADER = 'x-session-token';
export const INTERNAL_SESSION_PATH = '/internal/session';

/** Antwort von `GET /internal/session` (401 ohne gültige Sitzung). `access` nennt jedes Werkzeug. */
export const internalSessionSchema = z.object({
  user: platformUserSchema,
  csrfToken: z.string().min(16),
  access: z.object({ novelist: accessSchema, quest: accessSchema }),
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

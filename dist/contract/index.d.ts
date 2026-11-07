/**
 * Vertrag der internen Schnittstelle zwischen Plattform und Werkzeugen (dispositio-platform, PLAN.md §6). Beide Seiten prüfen ihre
 * Antworten in Vertragstests gegen diese Schemas. Eine Änderung, die ältere Werkzeuge bricht, bekommt eine neue Hauptversion.
 */
import { z } from 'zod';
/** Werkzeuge von Dispositio */
export declare const PRODUCT_KEYS: readonly ["novelist", "quest"];
export declare const productKeySchema: z.ZodEnum<{
    novelist: "novelist";
    quest: "quest";
}>;
export type ProductKey = z.infer<typeof productKeySchema>;
/** Woher eine Berechtigung stammt. `trial` und `paddle` kommen mit dem Verkauf (PLAN.md §10). */
export declare const ACCESS_SOURCES: readonly ["beta", "manual", "trial", "paddle"];
export declare const accessSourceSchema: z.ZodEnum<{
    beta: "beta";
    manual: "manual";
    trial: "trial";
    paddle: "paddle";
}>;
export type AccessSource = z.infer<typeof accessSourceSchema>;
/**
 * Zugang eines Nutzers zu einem Werkzeug, von der Plattform berechnet:
 *  - `active`: eine Berechtigung gilt (Ende `null` = offen)
 *  - `expired`: es gab eine, keine gilt mehr – das Werkzeug zeigt die Sperrseite mit Export
 *  - `none`: nie eine gehabt – das Werkzeug leitet zur Plattform
 */
export declare const accessSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    status: z.ZodLiteral<"active">;
    source: z.ZodEnum<{
        beta: "beta";
        manual: "manual";
        trial: "trial";
        paddle: "paddle";
    }>;
    endsAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>, z.ZodObject<{
    status: z.ZodLiteral<"expired">;
    endedAt: z.ZodISODateTime;
}, z.core.$strip>, z.ZodObject<{
    status: z.ZodLiteral<"none">;
}, z.core.$strip>], "status">;
export type Access = z.infer<typeof accessSchema>;
/** Angemeldeter Nutzer, wie ihn die Werkzeuge sehen – ohne E-Mail-Adresse. */
export declare const platformUserSchema: z.ZodObject<{
    id: z.ZodUUID;
    displayName: z.ZodString;
    avatarUrl: z.ZodNullable<z.ZodURL>;
    locale: z.ZodString;
}, z.core.$strip>;
export type PlatformUser = z.infer<typeof platformUserSchema>;
/** Ein Werkzeug für Produktumschalter und Hinweise: Name, Adresse (null = hier nicht erreichbar), im Betrieb oder angekündigt */
export declare const productInfoSchema: z.ZodObject<{
    key: z.ZodEnum<{
        novelist: "novelist";
        quest: "quest";
    }>;
    name: z.ZodString;
    url: z.ZodNullable<z.ZodURL>;
    status: z.ZodEnum<{
        live: "live";
        soon: "soon";
    }>;
}, z.core.$strip>;
export type ProductInfo = z.infer<typeof productInfoSchema>;
/** Header mit dem Wert des Sitzungs-Cookies, den ein Werkzeug an `GET /internal/session` weiterreicht */
export declare const SESSION_TOKEN_HEADER = "x-session-token";
export declare const INTERNAL_SESSION_PATH = "/internal/session";
/** Antwort von `GET /internal/session` (401 ohne gültige Sitzung, 403 bei falschem Werkzeug-Token). `access` nennt jedes Werkzeug. */
export declare const internalSessionSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodUUID;
        displayName: z.ZodString;
        avatarUrl: z.ZodNullable<z.ZodURL>;
        locale: z.ZodString;
    }, z.core.$strip>;
    csrfToken: z.ZodString;
    access: z.ZodObject<{
        novelist: z.ZodDiscriminatedUnion<[z.ZodObject<{
            status: z.ZodLiteral<"active">;
            source: z.ZodEnum<{
                beta: "beta";
                manual: "manual";
                trial: "trial";
                paddle: "paddle";
            }>;
            endsAt: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>, z.ZodObject<{
            status: z.ZodLiteral<"expired">;
            endedAt: z.ZodISODateTime;
        }, z.core.$strip>, z.ZodObject<{
            status: z.ZodLiteral<"none">;
        }, z.core.$strip>], "status">;
        quest: z.ZodDiscriminatedUnion<[z.ZodObject<{
            status: z.ZodLiteral<"active">;
            source: z.ZodEnum<{
                beta: "beta";
                manual: "manual";
                trial: "trial";
                paddle: "paddle";
            }>;
            endsAt: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>, z.ZodObject<{
            status: z.ZodLiteral<"expired">;
            endedAt: z.ZodISODateTime;
        }, z.core.$strip>, z.ZodObject<{
            status: z.ZodLiteral<"none">;
        }, z.core.$strip>], "status">;
    }, z.core.$strip>;
    products: z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<{
            novelist: "novelist";
            quest: "quest";
        }>;
        name: z.ZodString;
        url: z.ZodNullable<z.ZodURL>;
        status: z.ZodEnum<{
            live: "live";
            soon: "soon";
        }>;
    }, z.core.$strip>>;
    sessionExpiresAt: z.ZodISODateTime;
}, z.core.$strip>;
export type InternalSession = z.infer<typeof internalSessionSchema>;
/** `DELETE /internal/users/:id` beim Werkzeug: alle Daten des Nutzers löschen; 204, auch wenn nichts da ist. */
export declare const internalUserPath: (userId: string) => string;
/** Antwort von `GET /internal/users/:id/summary` beim Werkzeug (Admin-Bereich, Auskunft, Aufräumen). */
export declare const userSummarySchema: z.ZodObject<{
    projects: z.ZodNumber;
    words: z.ZodNumber;
    lastActivityAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export type UserSummary = z.infer<typeof userSummarySchema>;
/** Antwort von `GET /api/me` eines Werkzeugs */
export declare const toolMeSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodUUID;
        displayName: z.ZodString;
        avatarUrl: z.ZodNullable<z.ZodURL>;
        locale: z.ZodString;
    }, z.core.$strip>;
    csrfToken: z.ZodString;
    product: z.ZodEnum<{
        novelist: "novelist";
        quest: "quest";
    }>;
    access: z.ZodDiscriminatedUnion<[z.ZodObject<{
        status: z.ZodLiteral<"active">;
        source: z.ZodEnum<{
            beta: "beta";
            manual: "manual";
            trial: "trial";
            paddle: "paddle";
        }>;
        endsAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<"expired">;
        endedAt: z.ZodISODateTime;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<"none">;
    }, z.core.$strip>], "status">;
    products: z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<{
            novelist: "novelist";
            quest: "quest";
        }>;
        name: z.ZodString;
        url: z.ZodNullable<z.ZodURL>;
        status: z.ZodEnum<{
            live: "live";
            soon: "soon";
        }>;
    }, z.core.$strip>>;
    platformUrl: z.ZodURL;
    dev: z.ZodBoolean;
}, z.core.$strip>;
export type ToolMe = z.infer<typeof toolMeSchema>;
/** Fehler der Werkzeug-API, wenn Sitzung oder Zugang fehlen: wohin die Oberfläche weiterleitet */
export interface PlatformRedirectError {
    code: 'unauthorized' | 'forbidden';
    message: string;
    details: {
        redirect: string;
        access?: Access;
    };
}
/** Adressen der Plattform, die Werkzeuge verlinken (Seiten der Konto-App) */
export declare const platformLinks: (platformUrl: string, product: ProductKey) => {
    account: string;
    profile: string;
    security: string;
    /** nach dem Anmelden zurück zu `returnTo` (die Plattform lässt nur bekannte Werkzeuge zu) */
    login: (returnTo: string) => string;
    /** abmelden – überall, denn die Sitzung gehört der Plattform; danach zur Anmeldung mit Rückweg */
    logout: (returnTo: string) => string;
    noAccess: string;
};
//# sourceMappingURL=index.d.ts.map
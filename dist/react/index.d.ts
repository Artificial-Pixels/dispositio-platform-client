import { type ReactNode } from 'react';
import { type PlatformUser, type ToolMe } from '../contract/index.js';
/** Texte der Bausteine (Deutsch; für Englisch einzeln überschreibbar) */
export declare const DEFAULT_LABELS: {
    menu: string;
    account: string;
    profile: string;
    security: string;
    tools: string;
    current: string;
    soon: string;
    logout: string;
    expired: (product: string, date: string) => string;
    none: (product: string) => string;
    toAccount: string;
    more: string;
};
export type PlatformLabels = typeof DEFAULT_LABELS;
/** Leitet weiter, wenn eine Antwort der Werkzeug-API Sitzung oder Zugang verlangt (401/403 mit `details.redirect`). */
export declare function followPlatformRedirect(status: number, body: unknown): boolean;
/**
 * `GET /api/me` des Werkzeugs: die Sitzung. Ohne Anmeldung leitet sie zur Plattform weiter (und liefert null); bei anderen Fehlern
 * wirft sie. Ein Zugang, der fehlt oder abgelaufen ist, kommt mit – die Oberfläche entscheidet (Sperrseite, Weiterleitung).
 */
export declare function fetchToolMe(meUrl?: string): Promise<ToolMe | null>;
export interface PlatformSessionState {
    me: ToolMe | null;
    loading: boolean;
    error: Error | null;
    reload: () => void;
}
/** Sitzung für React (ohne react-query); wer react-query nutzt, nimmt `fetchToolMe` als queryFn. */
export declare function usePlatformSession(meUrl?: string): PlatformSessionState;
/** Profilbild der Plattform als Kreis; ohne Bild der erste Buchstabe des Namens. Rein schmückend. */
export declare function PlatformAvatar({ user, size }: {
    user: PlatformUser;
    size?: number;
}): import("react").JSX.Element;
/**
 * Eigener Eintrag des Werkzeugs im Konto-Menü (etwa „Einstellungen“): ein Link im Werkzeug. Mit `onSelect` wechselt die Oberfläche
 * selbst dorthin (Router, ohne Neuladen) und das Menü schließt sich; Strg-, ⌘- oder Mittelklick öffnen den Link wie gewohnt.
 */
export interface AccountMenuItem {
    label: string;
    href: string;
    onSelect?: () => void;
    testId?: string;
}
/**
 * Konto-Menü für die Kopfleiste eines Werkzeugs: Profilbild und Name; aufgeklappt Konto, Profil, Sicherheit (auf der Plattform),
 * darunter die eigenen Einträge des Werkzeugs (`items`), die Werkzeuge zum direkten Wechsel und Abmelden – überall, denn die Sitzung
 * gehört der Plattform. Die Plattform nennt in `me.products` nur die Werkzeuge dieses Kontos; hat es nur dieses eine, entfällt der
 * Abschnitt „Werkzeuge“ ganz – wer nur Novelist hat, sieht kein anderes Werkzeug.
 */
export declare function AccountMenu({ me, labels, returnTo, items }: {
    me: ToolMe;
    labels?: PlatformLabels;
    returnTo?: string;
    items?: AccountMenuItem[];
}): import("react").JSX.Element;
/**
 * Hinweis der Sperrseite: Zugang abgelaufen (dann bleibt der Export – `children`) oder nicht freigeschaltet (dann Weg zur Plattform).
 * Bei gültigem Zugang zeigt er nichts.
 */
export declare function LockedNotice({ me, productName, children, labels }: {
    me: ToolMe;
    productName: string;
    children?: ReactNode;
    labels?: PlatformLabels;
}): import("react").JSX.Element | null;
//# sourceMappingURL=index.d.ts.map
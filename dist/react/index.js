import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { platformLinks, toolMeSchema } from '../contract/index.js';
/** Texte der Bausteine (Deutsch; für Englisch einzeln überschreibbar) */
export const DEFAULT_LABELS = {
    menu: 'Konto',
    account: 'Konto',
    profile: 'Profil',
    security: 'Sicherheit',
    tools: 'Werkzeuge',
    current: 'geöffnet',
    soon: 'Bald',
    logout: 'Abmelden',
    expired: (product, date) => `Dein Zugang zu ${product} ist am ${date} abgelaufen. Deine Geschichten kannst du hier weiterhin exportieren.`,
    none: (product) => `${product} ist für dein Konto nicht freigeschaltet.`,
    toAccount: 'Zum Konto',
    more: 'Mehr erfahren',
};
/** Leitet weiter, wenn eine Antwort der Werkzeug-API Sitzung oder Zugang verlangt (401/403 mit `details.redirect`). */
export function followPlatformRedirect(status, body) {
    if (status !== 401 && status !== 403)
        return false;
    const redirect = body?.details?.redirect;
    if (typeof redirect !== 'string' || !/^https?:\/\//.test(redirect))
        return false;
    window.location.assign(redirect);
    return true;
}
/**
 * `GET /api/me` des Werkzeugs: die Sitzung. Ohne Anmeldung leitet sie zur Plattform weiter (und liefert null); bei anderen Fehlern
 * wirft sie. Ein Zugang, der fehlt oder abgelaufen ist, kommt mit – die Oberfläche entscheidet (Sperrseite, Weiterleitung).
 */
export async function fetchToolMe(meUrl = '/api/me') {
    const res = await fetch(meUrl, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    if (res.ok)
        return toolMeSchema.parse(body);
    if (followPlatformRedirect(res.status, body))
        return null;
    throw new Error(body?.message ?? `Anmeldung nicht möglich (${res.status}).`);
}
/** Sitzung für React (ohne react-query); wer react-query nutzt, nimmt `fetchToolMe` als queryFn. */
export function usePlatformSession(meUrl = '/api/me') {
    const [state, setState] = useState({ me: null, loading: true, error: null });
    const [round, setRound] = useState(0);
    useEffect(() => {
        let alive = true;
        fetchToolMe(meUrl).then((me) => alive && setState({ me, loading: me === null, error: null }), (error) => alive && setState({ me: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) }));
        return () => {
            alive = false;
        };
    }, [meUrl, round]);
    const reload = useCallback(() => setRound((r) => r + 1), []);
    return { ...state, reload };
}
/** Profilbild der Plattform als Kreis; ohne Bild der erste Buchstabe des Namens. Rein schmückend. */
export function PlatformAvatar({ user, size = 28 }) {
    return (_jsx("span", { className: "dp-avatar", style: { width: size, height: size, fontSize: Math.round(size * 0.42) }, "aria-hidden": "true", children: user.avatarUrl ? _jsx("img", { src: user.avatarUrl, alt: "", width: size, height: size, draggable: false }) : (user.displayName.trim()[0] ?? '?').toUpperCase() }));
}
/**
 * Konto-Menü für die Kopfleiste eines Werkzeugs: Profilbild und Name; aufgeklappt Konto, Profil, Sicherheit (auf der Plattform),
 * darunter die eigenen Einträge des Werkzeugs (`items`), die Werkzeuge zum direkten Wechsel und Abmelden – überall, denn die Sitzung
 * gehört der Plattform. Die Plattform nennt in `me.products` nur die Werkzeuge dieses Kontos; hat es nur dieses eine, entfällt der
 * Abschnitt „Werkzeuge“ ganz – wer nur Novelist hat, sieht kein anderes Werkzeug.
 */
export function AccountMenu({ me, labels = DEFAULT_LABELS, returnTo, items = [] }) {
    const links = platformLinks(me.platformUrl, me.product);
    const ref = useRef(null);
    const switchable = me.products.some((p) => p.key !== me.product);
    const back = returnTo ?? (typeof window !== 'undefined' ? window.location.href : me.platformUrl);
    // schließen bei Klick daneben oder Escape
    useEffect(() => {
        const close = (e) => {
            const el = ref.current;
            if (!el?.open)
                return;
            if (e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target))
                el.open = false;
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, []);
    return (_jsxs("details", { className: "dp-account-menu", ref: ref, "data-testid": "account-menu", children: [_jsxs("summary", { "aria-label": `${labels.menu}: ${me.user.displayName}`, children: [_jsx(PlatformAvatar, { user: me.user }), _jsx("span", { className: "dp-name", children: me.user.displayName })] }), _jsxs("div", { className: "dp-menu", children: [_jsx("a", { href: links.account, children: labels.account }), _jsx("a", { href: links.profile, children: labels.profile }), _jsx("a", { href: links.security, children: labels.security }), items.map((item) => (_jsx("a", { href: item.href, "data-testid": item.testId, onClick: (e) => {
                            if (!item.onSelect || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                                return;
                            e.preventDefault();
                            if (ref.current)
                                ref.current.open = false;
                            item.onSelect();
                        }, children: item.label }, item.href))), switchable && (_jsxs(_Fragment, { children: [_jsx("div", { className: "dp-menu-sep", role: "separator" }), _jsx("div", { className: "dp-menu-label", children: labels.tools }), me.products.map((p) => p.key === me.product ? (_jsxs("span", { className: "dp-menu-item dp-current", "aria-current": "page", children: [p.name, " ", _jsx("small", { children: labels.current })] }, p.key)) : p.status === 'soon' || !p.url ? (_jsxs("span", { className: "dp-menu-item dp-muted", children: [p.name, " ", p.status === 'soon' && _jsx("small", { className: "dp-pill", children: labels.soon })] }, p.key)) : (_jsx("a", { href: p.url, children: p.name }, p.key)))] })), _jsx("div", { className: "dp-menu-sep", role: "separator" }), _jsx("a", { href: links.logout(back), "data-testid": "account-logout", children: labels.logout })] })] }));
}
const dateDe = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
/**
 * Hinweis der Sperrseite: Zugang abgelaufen (dann bleibt der Export – `children`) oder nicht freigeschaltet (dann Weg zur Plattform).
 * Bei gültigem Zugang zeigt er nichts.
 */
export function LockedNotice({ me, productName, children, labels = DEFAULT_LABELS }) {
    const links = platformLinks(me.platformUrl, me.product);
    if (me.access.status === 'active')
        return null;
    return (_jsxs("section", { className: "dp-locked", "data-testid": "locked-notice", "data-access": me.access.status, children: [_jsx("p", { children: me.access.status === 'expired' ? labels.expired(productName, dateDe(me.access.endedAt)) : labels.none(productName) }), me.access.status === 'expired' && children, _jsxs("p", { className: "dp-locked-links", children: [_jsx("a", { href: links.account, children: labels.toAccount }), me.access.status === 'none' && _jsx("a", { href: links.noAccess, children: labels.more })] })] }));
}
//# sourceMappingURL=index.js.map
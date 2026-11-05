import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { platformLinks, toolMeSchema, type PlatformRedirectError, type PlatformUser, type ToolMe } from '../contract/index.js';

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
  expired: (product: string, date: string) => `Dein Zugang zu ${product} ist am ${date} abgelaufen. Deine Geschichten kannst du hier weiterhin exportieren.`,
  none: (product: string) => `${product} ist für dein Konto nicht freigeschaltet.`,
  toAccount: 'Zum Konto',
  more: 'Mehr erfahren',
};
export type PlatformLabels = typeof DEFAULT_LABELS;

/** Leitet weiter, wenn eine Antwort der Werkzeug-API Sitzung oder Zugang verlangt (401/403 mit `details.redirect`). */
export function followPlatformRedirect(status: number, body: unknown): boolean {
  if (status !== 401 && status !== 403) return false;
  const redirect = (body as Partial<PlatformRedirectError> | null)?.details?.redirect;
  if (typeof redirect !== 'string' || !/^https?:\/\//.test(redirect)) return false;
  window.location.assign(redirect);
  return true;
}

/**
 * `GET /api/me` des Werkzeugs: die Sitzung. Ohne Anmeldung leitet sie zur Plattform weiter (und liefert null); bei anderen Fehlern
 * wirft sie. Ein Zugang, der fehlt oder abgelaufen ist, kommt mit – die Oberfläche entscheidet (Sperrseite, Weiterleitung).
 */
export async function fetchToolMe(meUrl = '/api/me'): Promise<ToolMe | null> {
  const res = await fetch(meUrl, { credentials: 'same-origin', headers: { accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return toolMeSchema.parse(body);
  if (followPlatformRedirect(res.status, body)) return null;
  throw new Error((body as { message?: string } | null)?.message ?? `Anmeldung nicht möglich (${res.status}).`);
}

export interface PlatformSessionState {
  me: ToolMe | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/** Sitzung für React (ohne react-query); wer react-query nutzt, nimmt `fetchToolMe` als queryFn. */
export function usePlatformSession(meUrl = '/api/me'): PlatformSessionState {
  const [state, setState] = useState<Omit<PlatformSessionState, 'reload'>>({ me: null, loading: true, error: null });
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchToolMe(meUrl).then(
      (me) => alive && setState({ me, loading: me === null, error: null }),
      (error: unknown) => alive && setState({ me: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      alive = false;
    };
  }, [meUrl, round]);
  const reload = useCallback(() => setRound((r) => r + 1), []);
  return { ...state, reload };
}

/** Profilbild der Plattform als Kreis; ohne Bild der erste Buchstabe des Namens. Rein schmückend. */
export function PlatformAvatar({ user, size = 28 }: { user: PlatformUser; size?: number }) {
  return (
    <span className="dp-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" width={size} height={size} draggable={false} /> : (user.displayName.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Konto-Menü für die Kopfleiste eines Werkzeugs: Profilbild und Name; aufgeklappt Konto, Profil, Sicherheit (auf der Plattform), die
 * Werkzeuge zum direkten Wechsel und Abmelden – überall, denn die Sitzung gehört der Plattform. Die Plattform nennt in `me.products`
 * nur die Werkzeuge dieses Kontos; hat es nur dieses eine, entfällt der Abschnitt „Werkzeuge“ ganz – wer nur Novelist hat, sieht kein
 * anderes Werkzeug.
 */
export function AccountMenu({ me, labels = DEFAULT_LABELS, returnTo }: { me: ToolMe; labels?: PlatformLabels; returnTo?: string }) {
  const links = platformLinks(me.platformUrl, me.product);
  const ref = useRef<HTMLDetailsElement>(null);
  const switchable = me.products.some((p) => p.key !== me.product);
  const back = returnTo ?? (typeof window !== 'undefined' ? window.location.href : me.platformUrl);

  // schließen bei Klick daneben oder Escape
  useEffect(() => {
    const close = (e: Event): void => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  return (
    <details className="dp-account-menu" ref={ref} data-testid="account-menu">
      <summary aria-label={`${labels.menu}: ${me.user.displayName}`}>
        <PlatformAvatar user={me.user} />
        <span className="dp-name">{me.user.displayName}</span>
      </summary>
      <div className="dp-menu">
        <a href={links.account}>{labels.account}</a>
        <a href={links.profile}>{labels.profile}</a>
        <a href={links.security}>{labels.security}</a>
        {switchable && (
          <>
            <div className="dp-menu-sep" role="separator" />
            <div className="dp-menu-label">{labels.tools}</div>
            {me.products.map((p) =>
              p.key === me.product ? (
                <span key={p.key} className="dp-menu-item dp-current" aria-current="page">
                  {p.name} <small>{labels.current}</small>
                </span>
              ) : p.status === 'soon' || !p.url ? (
                <span key={p.key} className="dp-menu-item dp-muted">
                  {p.name} {p.status === 'soon' && <small className="dp-pill">{labels.soon}</small>}
                </span>
              ) : (
                <a key={p.key} href={p.url}>
                  {p.name}
                </a>
              ),
            )}
          </>
        )}
        <div className="dp-menu-sep" role="separator" />
        <a href={links.logout(back)} data-testid="account-logout">
          {labels.logout}
        </a>
      </div>
    </details>
  );
}

const dateDe = (iso: string): string => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });

/**
 * Hinweis der Sperrseite: Zugang abgelaufen (dann bleibt der Export – `children`) oder nicht freigeschaltet (dann Weg zur Plattform).
 * Bei gültigem Zugang zeigt er nichts.
 */
export function LockedNotice({ me, productName, children, labels = DEFAULT_LABELS }: { me: ToolMe; productName: string; children?: ReactNode; labels?: PlatformLabels }) {
  const links = platformLinks(me.platformUrl, me.product);
  if (me.access.status === 'active') return null;
  return (
    <section className="dp-locked" data-testid="locked-notice" data-access={me.access.status}>
      <p>{me.access.status === 'expired' ? labels.expired(productName, dateDe(me.access.endedAt)) : labels.none(productName)}</p>
      {me.access.status === 'expired' && children}
      <p className="dp-locked-links">
        <a href={links.account}>{labels.toAccount}</a>
        {me.access.status === 'none' && <a href={links.noAccess}>{labels.more}</a>}
      </p>
    </section>
  );
}

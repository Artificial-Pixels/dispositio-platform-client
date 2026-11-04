import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { platformLinks, type ToolMe } from '../src/contract/index.js';
import { AccountMenu, LockedNotice } from '../src/react/index.js';

const me = (access: ToolMe['access']): ToolMe => ({
  user: { id: '6f1c2c1e-8a8e-4a57-9a3e-2f0c9a0b7d11', displayName: 'Anna Berg', avatarUrl: null, locale: 'de' },
  csrfToken: 'c'.repeat(32),
  product: 'novelist',
  access,
  products: [
    { key: 'novelist', name: 'Dispositio Novelist', url: 'https://novelist.dispositio.app', status: 'live' },
    { key: 'quest', name: 'Dispositio Quest', url: null, status: 'soon' },
  ],
  platformUrl: 'https://dispositio.app',
  dev: false,
});

describe('Adressen der Plattform', () => {
  it('Konto, Anmelden und Abmelden mit Rückweg, kein Zugang', () => {
    const l = platformLinks('https://dispositio.app/', 'novelist');
    expect(l.account).toBe('https://dispositio.app/konto');
    expect(l.login('https://novelist.dispositio.app/p/1')).toBe('https://dispositio.app/konto/anmelden?weiter=https%3A%2F%2Fnovelist.dispositio.app%2Fp%2F1');
    expect(l.logout('https://novelist.dispositio.app/')).toBe('https://dispositio.app/konto/abmelden?weiter=https%3A%2F%2Fnovelist.dispositio.app%2F');
    expect(l.noAccess).toBe('https://dispositio.app/konto/kein-zugang/novelist');
  });
});

describe('Konto-Menü', () => {
  it('Name, Initiale, Links zur Plattform, dieses Werkzeug markiert, Quest „Bald“, Abmelden mit Rückweg', () => {
    const html = renderToStaticMarkup(<AccountMenu me={me({ status: 'active', source: 'beta', endsAt: null })} returnTo="https://novelist.dispositio.app/p/1" />);
    expect(html).toContain('Anna Berg');
    expect(html).toContain('>A</span>');
    expect(html).toContain('href="https://dispositio.app/konto/profil"');
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/Dispositio Quest <small class="dp-pill">Bald<\/small>/);
    expect(html).toContain('href="https://dispositio.app/konto/abmelden?weiter=https%3A%2F%2Fnovelist.dispositio.app%2Fp%2F1"');
  });
});

describe('Sperrseite', () => {
  it('abgelaufen: Datum und Export (children); aktiv: nichts; nie freigeschaltet: Weg zur Plattform', () => {
    const expired = renderToStaticMarkup(
      <LockedNotice me={me({ status: 'expired', endedAt: '2026-10-01T10:00:00.000Z' })} productName="Novelist">
        <button>Alle Geschichten exportieren</button>
      </LockedNotice>,
    );
    expect(expired).toContain('Dein Zugang zu Novelist ist am 1. Oktober 2026 abgelaufen.');
    expect(expired).toContain('Alle Geschichten exportieren');
    expect(renderToStaticMarkup(<LockedNotice me={me({ status: 'active', source: 'beta', endsAt: null })} productName="Novelist" />)).toBe('');
    const none = renderToStaticMarkup(
      <LockedNotice me={me({ status: 'none' })} productName="Novelist">
        <button>Export</button>
      </LockedNotice>,
    );
    expect(none).toContain('nicht freigeschaltet');
    expect(none).not.toContain('Export');
    expect(none).toContain('href="https://dispositio.app/konto/kein-zugang/novelist"');
  });
});

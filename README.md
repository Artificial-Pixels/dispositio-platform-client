# @dispositio/platform-client

Das kleine Paket, mit dem die Dispositio-Werkzeuge (Novelist, später Quest) an die Plattform `dispositio.app` angebunden sind. Mehr
teilen Plattform und Werkzeuge bewusst nicht. Hintergrund und Plan: `dispositio-platform/PLAN.md` (§6).

## Inhalt

| Einstieg | Inhalt |
|---|---|
| `@dispositio/platform-client/contract` | zod-Schemas der internen Schnittstelle (`GET /internal/session`, Zugang, Zusammenfassung, `GET /api/me`), `platformLinks` |
| `@dispositio/platform-client/server` | Fastify-Plugin `platformAuth`, `userIdOf`, `registerPlatformInternalRoutes` |
| `@dispositio/platform-client/react` | `usePlatformSession`, `fetchToolMe`, `followPlatformRedirect`, `AccountMenu`, `LockedNotice`, `PlatformAvatar` |
| `@dispositio/platform-client/styles/tokens.css` | Farben und Schriften (wie Novelist) |
| `@dispositio/platform-client/styles/platform.css` | Stile der Bausteine |

## Im Werkzeug (Server)

```ts
import { platformAuth, registerPlatformInternalRoutes, userIdOf } from '@dispositio/platform-client/server';

await app.register(platformAuth, {
  product: 'novelist',
  platformUrl: process.env.PLATFORM_INTERNAL_URL,   // z. B. http://platform:3100; leer = Entwicklungsmodus
  internalToken: process.env.PLATFORM_INTERNAL_TOKEN,
  publicPlatformUrl: 'https://dispositio.app',
  cookieName: '__Secure-dp_session',
  publicUrl: 'https://novelist.dispositio.app',
});

app.get('/api/projects', async (req) => listProjects(userIdOf(req)));                          // Zugang nötig (Standard)
app.get('/api/projects/:id/backup', { config: { platform: 'export' } }, …);                    // auch bei abgelaufenem Zugang
app.get('/api/health', { config: { platform: 'public' } }, …);                                  // ohne Anmeldung

registerPlatformInternalRoutes(app, { internalToken, deleteUser, summary });
```

Abgewiesene Anfragen antworten mit 401 bzw. 403 und `details.redirect` (Anmeldung bzw. „kein Zugang“ auf der Plattform);
`followPlatformRedirect(status, body)` im API-Client der Oberfläche leitet dorthin. Der Entwicklungsmodus (ohne `platformUrl`) meldet
einen festen Testnutzer an; mit `devAccess: 'expired'` bzw. `'none'` lassen sich Sperrseite und Weiterleitung ausprobieren.

**Content-Security-Policy des Werkzeugs:** Profilbilder kommen von der Plattform – `img-src` braucht deren Adresse.

## Einbinden

Das Paket wird per Git-Tag installiert, ohne Paketdienst:

```bash
npm install "git+https://github.com/Artificial-Pixels/dispositio-platform-client.git#v1.0.0"
```

Jeder Tag enthält das gebaute `dist/`; Werkzeuge bauen das Paket nicht selbst. Neue Version: Tag im `package.json` des Werkzeugs
erhöhen und `npm install` ausführen.

## Entwicklung

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build      # nach dist/ (nur für Releases nötig)
```

## Releases

1. Änderungen unter `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) eintragen und alles committen.
2. `npm run release:patch` (bzw. `release:minor`, `release:major`). Das Skript ([scripts/release.mjs](scripts/release.mjs)) prüft,
   committet „Release x.y.z“ auf `main`, baut und legt neben `main` einen Commit mit `dist/` an, auf dem der Tag `vX.Y.Z` steht.
3. `git push origin main vX.Y.Z`.

**Verträglichkeit:** Ältere Werkzeuge müssen mit einer neuen Plattform weiterlaufen. Was sie bricht (Felder entfernen oder umdeuten,
Schemas verschärfen), bekommt eine neue Hauptversion; neue optionale Felder sind eine MINOR-Version.

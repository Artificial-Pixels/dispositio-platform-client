# @dispositio/platform-client

Das kleine Paket, mit dem die Dispositio-Werkzeuge (Novelist, später Quest) an die Plattform `dispositio.app` angebunden sind. Mehr
teilen Plattform und Werkzeuge bewusst nicht. Hintergrund und Plan: `dispositio-platform/PLAN.md` (§6).

## Inhalt

| Einstieg | Stand | Inhalt |
|---|---|---|
| `@dispositio/platform-client/contract` | da | zod-Schemas der internen Schnittstelle: `GET /internal/session`, Zugang je Werkzeug, Zusammenfassung eines Nutzers |
| `@dispositio/platform-client/server` | P6 | Fastify-Plugin: Sitzung bei der Plattform prüfen (60 s Zwischenspeicher), `requireAccess`, CSRF, `/api/me`, interne Routen, Entwicklungsmodus |
| `@dispositio/platform-client/react` | P6 | Kopfleiste mit Konto-Menü und Produktumschalter, Sperrseite |
| `@dispositio/platform-client/styles/tokens.css` | P6 | Farben, Schriften, Akzentfarbe je Werkzeug |

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

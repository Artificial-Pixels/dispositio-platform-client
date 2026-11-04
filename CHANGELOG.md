# Changelog

Alle Änderungen an `@dispositio/platform-client`, aus Sicht der Werkzeuge, die es einbinden. Das Format folgt
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionsnummern folgen
[Semantic Versioning](https://semver.org/lang/de/): Eine Änderung, die ältere Werkzeuge bricht, bekommt eine neue Hauptversion.

## [Unreleased]

## [1.0.0] - 2026-11-04

### Hinzugefügt

- **Vertrag der internen Schnittstelle** (`@dispositio/platform-client/contract`): zod-Schemas für `GET /internal/session`
  (Nutzer ohne E-Mail-Adresse, CSRF-Token, Zugang je Werkzeug, Liste der Werkzeuge), den Zugang (`active`, `expired`, `none`), die
  Zusammenfassung eines Nutzers und `GET /api/me` eines Werkzeugs; Pfade und Header der internen Endpunkte; Adressen der Plattform
  (`platformLinks`: Konto, Profil, Anmelden und Abmelden mit Rückweg, kein Zugang).
- **Fastify-Plugin** (`/server`): `platformAuth` prüft für jede API-Route Sitzung und Zugang bei der Plattform (60 s
  Zwischenspeicher, Schlüssel ist der Hash des Cookies), CSRF-Token und Origin; standardmäßig verschlossen, Routen öffnen sich mit
  `config.platform` (`export`, `session`, `public`). Abgewiesene Anfragen nennen das Ziel der Weiterleitung. Dazu `GET /api/me`,
  `userIdOf(req)`, ein Entwicklungsmodus ohne Plattform (fester Testnutzer, Zugang einstellbar) und
  `registerPlatformInternalRoutes` für Löschen und Zusammenfassung (nur mit Token, nicht über den Proxy).
- **React-Bausteine** (`/react`): `fetchToolMe` und `usePlatformSession` (leiten ohne Anmeldung zur Plattform),
  `followPlatformRedirect` für die eigene API, `AccountMenu` (Konto, Profil, Sicherheit, Werkzeuge, Abmelden), `LockedNotice` für
  die Sperrseite, `PlatformAvatar`.
- **Stile:** `styles/tokens.css` (Farben und Schriften von Dispositio) und `styles/platform.css` (Bausteine).

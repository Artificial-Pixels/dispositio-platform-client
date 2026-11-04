# Changelog

Alle Änderungen an `@dispositio/platform-client`, aus Sicht der Werkzeuge, die es einbinden. Das Format folgt
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionsnummern folgen
[Semantic Versioning](https://semver.org/lang/de/): Eine Änderung, die ältere Werkzeuge bricht, bekommt eine neue Hauptversion.

## [Unreleased]

### Hinzugefügt

- **Vertrag der internen Schnittstelle** (`@dispositio/platform-client/contract`): zod-Schemas für `GET /internal/session`
  (Nutzer ohne E-Mail-Adresse, CSRF-Token, Zugang je Werkzeug), den Zugang (`active`, `expired`, `none`) und die Zusammenfassung
  eines Nutzers; Pfade und Header der internen Endpunkte.

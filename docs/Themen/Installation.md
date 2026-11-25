# Installation — Ausrollen, Sichern, Zugang

Stand 2026-10-15. Zurück zum [Einstieg](../README.md).

Eine Hetzner-Maschine, zwei Umgebungen aus einem Abbild, das **nur CI
baut**: ein Push auf `preprod` rollt nach dev aus, einer auf `main` nach
prod — erst wenn Tests und der Durchstich gegen eine frische Postgres grün
sind. Migrationen laufen beim Start, vorwärts und je einmal; eine, die
entfernt, nennt ihre Prüfabfrage und läuft nur mit Freigabe (T-076).
Angemeldet wird mit einem Passwort je Konto; die Rolle am Tisch steht am
Konto, je Kampagne.

Das Bild der Container steht unter [Technik](Technik.md); der Weg vom Push
zum Server in [Architektur §2](../Architektur.md#2-vom-push-bis-zum-server).

## Wo es tiefer weitergeht

| Frage | Seite |
|---|---|
| Ein Artikel ist weg | [Betrieb › Artikel weg?](../Betrieb.md#artikel-weg--zuerst-die-ebenen-prüfen) |
| Was bei einem Push passiert, wenn Ausrollen fehlschlägt | [Betrieb › Was bei einem Push passiert](../Betrieb.md#was-bei-einem-push-passiert) |
| Den Server einrichten (einmal) | [Betrieb › Den Server einrichten](../Betrieb.md#den-server-einrichten--schritt-für-schritt-einmal) |
| Sichern und zurück | [Betrieb › Sichern](../Betrieb.md#sichern), [Zurück](../Betrieb.md#zurück) |
| Was Daten löschen kann | [Betrieb › Was Daten löschen kann](../Betrieb.md#was-daten-löschen-kann) |
| Register gegen Datenbank (T-123) | [Betrieb › Register](../Betrieb.md#register-datenbank-gegen-startzeilen-t-123) |
| Übernahme dev ↔ prod | [Betrieb › Übernahme](../Betrieb.md#übernahme-dev--prod) |
| Konten, Rollen, wer was darf | [Zugang.md](../Zugang.md) |
| API-Tokens und Werkzeugzugang | [Zugang › API-Tokens](../Zugang.md#api-tokens), [Betrieb › Werkzeugzugang](../Betrieb.md#werkzeugzugang) |
| Lokal entwickeln | [../README.md › Entwickeln](../../README.md#entwickeln) |

## Stand

Beide Umgebungen laufen; was fehlt, steht am Ende von
[Betrieb.md](../Betrieb.md#was-noch-fehlt) und [Zugang.md](../Zugang.md#was-noch-fehlt).

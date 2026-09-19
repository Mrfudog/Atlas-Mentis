# Kanalgang — Selbst-Hosting

SL-Werkzeug für das Kanalnetz von Wasserfeste: Stadtkarte mit Hexraster,
Kanal-Graph, Encounter-Engine, Monster-Statblocks (Import/Export im
Obsidian-Statblock-Format) und persistentem Zustand.

## Komponenten

| Komponente | Zweck |
| --- | --- |
| **Vite + React** (nur Build-Zeit) | bündelt `src/` zu statischen Dateien in `dist/` |
| **Node/Express** (`server.js`) | liefert `dist/` aus **und** stellt die Mini-API `/api/state` bereit |
| **Volume `/data`** | `state.json` — der komplette Spielstand als Key-Value-Ablage |
| **`src/storage.js`** | Polyfill für die claude.ai-Storage-API: spricht die Server-API, fällt auf localStorage zurück |
| **Reverse Proxy + SSO** (bestehend) | Zugriffsschutz — die App selbst hat **kein** Auth |

Ein einziger Container genügt; das Build läuft als Multi-Stage im Dockerfile.

## Start

```bash
docker compose up -d --build
# → http://<host>:8080
```

Der Stand liegt danach in `./daten/state.json` (Bind-Mount) — ins Backup aufnehmen.

## Stand aus dem claude.ai-Artefakt übernehmen

Im Artefakt: Tab **Daten → Export erzeugen → kopieren**.
In der gehosteten Instanz: Tab **Daten → einfügen → Importieren**.
Die eingebaute Migration ergänzt fehlende Felder automatisch.

## Wichtig: Rechte & Spieler-Ansicht

Die Spieler-Ansicht ist **nur ein UI-Schalter** — wer die URL erreicht, sieht mit
einem Klick alles (Fraktionsgebiete, Verstecke, verdeckte Knoten). Also:

- Instanz hinter den Reverse Proxy + SSO legen (nur SL-Zugriff), **oder**
- den Spielern nie die URL geben, sondern die Spieler-Ansicht am Tisch zeigen
  (Beamer/Tablet mit eigener, eingeloggter Sitzung).

## Mehrgeräte-Betrieb

Alle Geräte teilen denselben Server-Stand (`state.json`). Änderungen werden beim
Speichern übertragen; ein zweites Gerät sieht sie nach einem **Reload**
(kein Live-Sync — letzter Schreiber gewinnt). Für den Tisch reicht das:
SL-Gerät bearbeitet, Anzeige-Gerät lädt vor dem Aufdecken neu.

## Ausbaustufen (bei Bedarf)

- Live-Sync über Server-Sent Events oder ein kurzes Polling in `storage.js`
- Mehrere Kampagnen: `STORAGE_KEY` in `src/App.jsx` pro Instanz/Query-Parameter variieren
- Basic-Auth direkt im Express, falls kein SSO davor hängt

## Entwicklung ohne Docker

```bash
npm install
npm run dev      # Vite-Devserver (Storage fällt auf localStorage zurück)
npm run build && npm start   # Produktionslauf lokal
```

## Auf GitHub veröffentlichen

```bash
cd kanalgang-selfhost
git init && git add . && git commit -m "Kanalgang: initial"
git branch -M main
git remote add origin git@github.com:<dein-user>/kanalgang.git
git push -u origin main
```

`daten/` (Spielstand) und `node_modules/` bleiben via `.gitignore` draussen. Für einen automatischen Container-Build kann später eine GitHub Action `docker build` ausführen und ins GitHub Container Registry pushen.

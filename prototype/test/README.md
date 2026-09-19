# Prüfaufbau für den Prototyp

Der Prototyp läuft als Artefakt gegen `claude.use("db")`. Damit er sich hier
prüfen lässt, baut `build-harness.mjs` zwei Seiten, die dieselbe Datei mit
einem nachgebildeten `window.claude` laden:

- `harness/index.html` — mit Daten aus `dbdump/`
- `harness/stumm.html` — der Speicher antwortet nie (prüft die Wachmeldung)

## Warum der Stub einfriert

Der echte Speicher liefert eingefrorene Objekte aus: *„Delivered snapshots and
their `data()` are frozen."* Unter `"use strict"` wirft jede Zuweisung darauf —
und zwar im Snapshot-Callback, wo sie niemand auffängt. Genau daran ist v8
gescheitert: `b.id=b.id||d.id` warf, die Artikelliste blieb leer, die Seite
stand auf „Lädt…".

Ein Stub, der nicht einfriert, findet das nicht. Deshalb friert dieser tief ein
(`tiefKalt`). Das ist der Zweck des Aufbaus, nicht ein Detail.

## Daten

`dbdump/registry/<teil>.json` und `dbdump/entities/<id>.json` — mit dem
`ArtifactData`-Werkzeug aus dem Artefakt gezogen. **Nicht eingecheckt**: das
Repo ist öffentlich, die Daten sind Kampagneninhalt. `.gitignore` deckt
`dbdump/` und `harness/` ab.

## Lauf

    pnpm dlx playwright@1 install chromium   # einmalig, falls nötig
    node build-harness.mjs
    node pruefe.mjs

Erwartet: `index` zeigt Zeilen und keine Meldung, `stumm` zeigt nach zehn
Sekunden die Wachmeldung und bleibt nicht auf „Lädt…".

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

    pnpm install                             # bringt Playwright mit
    node prototype/test/build-harness.mjs
    node prototype/test/pruefe.mjs

Die Pfade hängen an den Dateien, nicht am Arbeitsverzeichnis — der Lauf geht
von überall. Liegt unter `/opt/pw-browsers/chromium` ein Chromium (so in der
Ausspielumgebung), nimmt der Lauf den; sonst den, den Playwright mitbringt.

Der Griff nach innen (`window.__T__`) reicht `REG` und `ENT` als
Zugriffsfunktionen heraus, nicht als Werte: `ENT` wird beim Schnappschuss
neu gesetzt, und ein festgehaltener Wert zeigte für immer auf die leere Map
vom Seitenanfang.

Erwartet: `index` zeigt Zeilen und keine Meldung, `stumm` zeigt nach zehn
Sekunden die Wachmeldung und bleibt nicht auf „Lädt…".

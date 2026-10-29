# Leistung: Regeln, Budgets, Messung

Von der Leitung verlangt am 29.10.2026 (T-398, REQ-397): **Leistung wird bei
jeder Umsetzung mitgedacht, nicht nachträglich gesucht.** Diese Seite ist die
Vorgabe dafür. Sie gilt für jede Änderung an Server, Oberfläche und Modell, so
wie die Grundanforderungen in [CLAUDE.md](../CLAUDE.md).

Anlass war die [Laden-Analyse](vorschlaege/Laden-Analyse.md) vom 28.10.: Die
Artikelseite einer Figur stellte über hundert Abrufe, und nach jeder Änderung
las der Server den ganzen Bestand neu (30 s, 502). Keiner dieser Fehler war
für sich gross, und keiner fiel auf, weil nichts gezählt wurde. Darum steht
hier, **was gezählt wird**.

## Die Regeln

Jede Regel hat eine Kennung; ein Kommentar im Code oder ein Review nennt sie
(`P1`), wie bei den Entscheidungen.

| | Regel | Warum | Woran man den Verstoss erkennt |
|---|---|---|---|
| **P1** | **Kein Abruf je Element.** Braucht eine Seite viele Dinge, fragt sie in *einem* Abruf: `ids=`, `name=`, `/api/entities/batch`, oder der Server bringt sie in `refs` mit. | Hundert kleine Abrufe stauen sich am Server und bremsen alle anderen Konten. | `for (…) void this.api.…` oder `for (…) this.bestand.oeffnen(…)` in einer Komponente oder einem Effekt. |
| **P2** | **Keine doppelte Frage.** Fragen zwei Stellen gleichzeitig dasselbe, teilen sie die laufende Frage (`prefs()`, `Heim.laden`, `Bestand.oeffnen`). Ein Effekt merkt sich den Schlüssel seiner letzten Frage und fragt nicht erneut, wenn derselbe Artikel wiederkommt. | Ein zweites Mal kostet genauso viel wie das erste. | In `scripts/laden-messen.mjs` oder `abrufe.spec.ts` erscheint dieselbe Adresse zweimal. |
| **P3** | **Der Browser hält keinen Bestand** (W7). Listen kommen seitenweise vom Server (höchstens 200 Zeilen), nie alle Artikel. | 56 000 Artikel sind viele Megabyte, bevor eine Zeile steht. | Ein `limit` über 200; eine Liste, die alle Zeilen holt, um im Browser zu filtern. |
| **P4** | **Am Server höchstens ein Durchlauf über den Bestand je Anfrage**, und keiner je Artikel. Was viele Anfragen brauchen (Namen, Rückbezüge, Wissen, Stapel), wird **je Stempel einmal** als Index gerechnet. `roh().map` lesen, nie `new Map(await repo.listEntities())` je Route. | Der Bestand hat über 200 000 Zeilen. Ein Durchlauf je Artikel ist quadratisch. | `[...map.values()].filter` oder `stand.alle.filter` in einer Funktion, die je Artikel läuft. |
| **P5** | **Schreiben macht nicht alles neu.** Eine geänderte Zeile darf nicht den ganzen Bestand, alle Indizes und alle Siebe verwerfen (Hebel 3 der Analyse). Bis das steht, kommt kein **neuer** Index dazu, der nach jedem Schreiben ganz neu gebaut wird. | Am Tisch wird ständig geschrieben, etwa Trefferpunkte. | Ein neuer Cache, der am Stempel hängt und nicht nachgeführt wird. |
| **P6** | **Das Startpaket wächst nicht.** Neue Seiten werden als Route mit `loadComponent` geladen. Grosse Daten und Texte (JSON, Hilfe, Handbuch) kommen per `import()` oder `@defer`. Das Budget in `angular.json` wird **nicht** angehoben (Grundanforderung 5); stattdessen etwas anderes nachladen oder eine Aufgabe im Bereich Performance anlegen. | Am Telefon zählt jedes Kilobyte vor dem ersten Bild. | `ng build` meldet das Budget; ein statischer `import … from '*.json'` in `kern/`. |
| **P7** | **Bilder in Listen sind Vorschaubilder**, kommen mit `loading="lazy"` und tragen eine Version in der Adresse (dann `immutable`). | Die Kartenliste lud 39 Bilder zu je 1–3 s. | `<img>` ohne `loading`, ein Kartenbild ohne `?v=`. |
| **P8** | **Was gemessen werden kann, wird gemessen.** Wer einen Ladepfad ändert (eine neue Seite, ein neuer Abruf, ein neuer Effekt, der fragt), nimmt ihn in `apps/web/e2e/abrufe.spec.ts` auf, mit seiner Grenze. Der PR nennt die Zahl der Abrufe vorher und nachher. | Eine Grenze, die niemand prüft, gilt nicht. | Der PR ändert `api.ts` oder einen `effect`, der fragt, ohne Messung. |

## Budgets

Gemessen mit dem ganzen Bestand auf dev, nach einer Aufwärmrunde. Die Werte
sind die Zielwerte der Analyse; bestätigt sind sie, sobald die Leitung sie
abnimmt. Wer eine Grenze reissen müsste, legt eine Aufgabe an (P6) und hebt
sie nicht still an.

| Was | Grenze | Prüft |
|---|---:|---|
| API-Abrufe einer Artikelseite | ≤ 25, keiner doppelt | `abrufe.spec.ts` |
| Listenabrufe für die Übungen eines Statblocks | 1 | `abrufe.spec.ts`, `statblock-abrufe.test.ts` |
| Einzelabrufe der Karten eines Boards | 0 (ein Batch) | `abrufe.spec.ts`, `bestand-viele.test.ts` |
| Artikelseite steht, Desktop / Telefon | ≤ 2 s / ≤ 2,5 s | `scripts/laden-messen.mjs` |
| Kompendium, erste Zeilen | ≤ 1,5 s | `scripts/laden-messen.mjs` |
| Serverzeit `/api/entities/:id` (p95) | ≤ 0,3 s | `Server-Timing`, `laden-messen.mjs` |
| Serverzeit `/api/me`, `/api/home` | ≤ 0,1 s | `Server-Timing` |
| Erster Listenabruf nach einer Änderung | ≤ 2 s, nie 502 | `laden-messen.mjs` nach einem Schreiben |
| Startpaket | Fehlergrenze in `angular.json`, Ziel < 1 MB | `ng build` |

## Messen

- **Bei jedem PR**, der einen Ladepfad ändert: `pnpm e2e abrufe` und der
  betroffene Spec. Die CI führt alle E2E-Specs aus.
- **Gegen dev**, vorher und nachher, ohne Inhalte:

  ```bash
  node scripts/laden-messen.mjs --base https://dev.ttrpg.fuchsbau.io \
    --artikel <figur-id> --karte <karten-id> --board <board-id> \
    [--als <konto-id>] [--nur Artikel,Board] [--json messung.json]
  ```

- **Am Server** nennt `Server-Timing` je Antwort die Abschnitte
  (`apps/server/src/zeitmessung.ts`): `app` gesamt, `db` (alle Aufrufe des
  Repositorys, mit Zahl), `stand` (Bestand lesen), `sieb`, `index`
  (Listenindex bauen). Das Messscript schreibt sie hinter jeden Abruf. Ein
  neuer teurer Abschnitt bekommt sein `messe('name', …)`.
- **Nach jedem Release** vergleicht der Prüflauf T-322 mit der Grundlinie
  unten. Ein Rückschritt wird eine Aufgabe im Bereich Performance.

## Grundlinie

| Datum | Stand | Artikelseite (Figur) | Kompendium | Board | Kartenliste | Startpaket |
|---|---|---:|---:|---:|---:|---:|
| 28.10.2026 | preprod `407935f5`, vor T-398 | > 60 s, 150 Abrufe | 8,2 s | 18,6 s | 29,9 s | 1,25 MB |

Neue Zeilen kommen oben dazu, mit der Messung aus `laden-messen.mjs`.

## Im Review

Wer einen PR liest, fragt der Reihe nach:

1. Fragt etwas je Element (P1) oder doppelt (P2)?
2. Läuft am Server etwas je Artikel über den ganzen Bestand (P4)?
3. Kommt ein Index dazu, der bei jedem Schreiben verfällt (P5)?
4. Wächst das Startpaket (P6)?
5. Ist der neue Ladepfad gemessen (P8)?

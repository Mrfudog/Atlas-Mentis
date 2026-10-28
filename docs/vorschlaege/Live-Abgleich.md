# Live-Abgleich zwischen Sitzungen (T-399) — Bestand und Lücken

Stand 28.10.2026, Nachtlauf. Zu REQ-398 (Änderungen der Leitung erscheinen
sofort bei allen), Bezug REQ-116 (Live-Kanal je Sitzung) und REQ-192
(Revisionen, Zusammenführen).

## Kurz

Der Live-Kanal steht und ist **vollständig an der Quelle**: jedes Schreiben
eines Artikels geht durch die Hülle `mitKanal` um das `Repository`
(`apps/server/src/live.ts`), also meldet sich jede Route, auch die, die
morgen dazukommt. Was fehlt, liegt an drei Stellen:

1. **Durchsickern über den Takt** — eine Karte meldet sich bei Spielenden
   auch dann, wenn sich nur Verborgenes änderte (ein verborgener Gegner
   zieht, ein Token unter dem Nebel). Der Inhalt bleibt gesiebt, aber das
   Ereignis selbst sagt: „da tat sich etwas“. (Akzeptanz 3)
2. **Wiederverbinden am Telefon** — eine still tote Verbindung (Telefon
   geweckt, Mobilfunk gewechselt) merkt die Seite erst nach bis zu 15
   Minuten; und nach `reset` fragen Play, Initiative, Kartenkontext,
   Zugplaner und Seitenleiste nicht neu. (Akzeptanz 2)
3. **Gleichzeitig auf der Karte** — die Karte ist ein Artikel; schreiben
   zwei (die Leitung malt Nebel, eine Spielerin zieht ihr Token), wird der
   Zweite mit 409 abgewiesen und muss es nochmals tun, obwohl sich die
   beiden Änderungen nicht berühren. (Akzeptanz 4)

```vis ablauf
Leitung schreibt (PUT / POST move / door / tracker)
  → mitKanal meldet {entity, id, before}
  → LocalChangeFeed bündelt (50 ms, je Artikel zusammengelegt, Ring 1000)
  → GET /api/live: je Empfänger gesiebt (sieveFuer) → entity | gone | session | plan | roll | reset
  → Browser: Live → Bestand holt den Artikel gesiebt neu → Karte, Tracker, Play zeichnen
```

## Wie es heute läuft

| Teil | Wo | Was es tut |
|---|---|---|
| Quelle | `live.ts` `mitKanal`, `LocalChangeFeed` | jedes `putEntity`/`deleteEntity`/`putRegistryPart` meldet sich; Bündel je 50 ms, je Artikel zusammengelegt; ab 200 Artikeln `reset`; Ring von 1000 zum Nachholen |
| Route | `GET /api/live` (SSE) | `hello`, `entity`, `gone`, `session`, `registry`, `reset`, `roll`, `plan`; je Empfänger gesiebt mit derselben Rechnung wie `GET /api/entities/:id`; Konto bei jedem Bündel frisch gelesen; Nachholen über `Last-Event-ID` bzw. `?since=`; neuer Prozess → `reset` |
| Browser | `apps/web/src/app/kern/live.ts` | `EventSource`, eigenes Neuverbinden mit wachsender Pause, wenn der Browser aufgibt; verteilt an `onArtikel`, `onSitzung`, `onNeu`, `onWurf`, `onPlan`; Stand `aus`/`verbindet`/`offen` als Punkt in der Kopfleiste |
| Bestand | `kern/bestand.ts` | holt jeden geöffneten Artikel bei `entity` neu (gesiebt), wirft ihn bei `gone` weg, bei `reset` alles Geöffnete neu |
| Gleichzeitig | Server: Revision je Artikel, 409; Artikelmaske: `mergeEntity` | die Karte (über `Brett.schreiben`) lädt bei 409 neu und sagt „please try again“ |

## Je Objekt

| Objekt | Wie gespeichert | Kommt live? | Lücke |
|---|---|---|---|
| **Karte** (Bild, Gitter, Wände, Licht, Blätter, Ebenen) | Felder der Karte `Map` am Kartenartikel | ja — `entity` der Karte → Bestand holt sie | **(1)** auch wenn sich nur Verborgenes änderte; **(3)** 409 bei gleichzeitigem Schreiben |
| **Token, Marker, Grösse, Drehung, Sichtbarkeit** | `marker`-Kanten der Karte (`props.x/y/size/rot/hidden`) | ja, als `entity` der Karte; `hidden` und Fremdes wird gesiebt (`redactMap`) | **(1)** ein verborgener Marker, der zieht, meldet sich bei Spielenden; **(3)** zwei Tokens gleichzeitig: einer wird abgewiesen |
| **Nebel** | `Map.fog`, `Map.reveal` (je Figur: `for`) | ja, als `entity` der Karte; Marker unter dem Nebel gesiebt, Nebel je Figur (`revealFor`) | **(1)** ein Token zieht unter dem Nebel → Ereignis bei Spielenden; **(3)** Malen und Aufdecken beim Ziehen (`reveal`) zugleich → 409 (hier ist es ein echter Konflikt am selben Feld) |
| **Kartenwechsel** | `Session.activeMap/activeEncounter/activeScene` | ja, `session` → Play holt den Tisch neu; Freigabe (T-289) über `entity` einer Karte | nach `reset` fragt Play nicht neu **(2)** |
| **Initiative** | Begegnung (Kanten `participant`, Feld `Encounter`) | ja, `entity` der Begegnung → Tracker fragt `GET /api/encounters/:id/tracker` neu | nach `reset` nicht neu **(2)**; Werte aus dem Statblock (AC, Max-TP) erst beim nächsten Zug |
| **Zugplan** | eigener Speicher, `plan`-Ereignis | ja | nach `reset` nicht neu **(2)** |
| **Würfe** | Ereignisse, `roll` | ja, gesiebt mit `rollVisible` | — (verpasste Würfe kommen über den Ring nach) |
| **Board** | Kanten `placed` am Board | ja für Artikel, die schon in der Antwort stehen | ein **neu** passender Artikel erscheint erst beim Neuladen; nach `reset` nicht neu |
| **Artikel** (geöffnet) | Artikel | ja, über den Bestand | — |
| **Inventar** | `holds`-Kanten am Behälter | ja, Behälter sind geöffnete Artikel | — |
| **Register** | Registerzeilen | ja, `registry` → Register neu | — |

## Schnitte (in dieser Reihenfolge)

1. **Karte, Token, Nebel: nur melden, was der Empfänger anders sieht**
   (Akzeptanz 3). Die Route siebt den Artikel vorher und nachher je
   Empfänger und schweigt, wenn beides gleich ist (ohne Revision und
   Zeitstempel). Die Leitung sieht alles und bekommt weiter jede Meldung.
   Nebenbei holen Spielende die Karte seltener.
   *Prüfung:* Serverprobe mit zwei Konten — ein verborgener Gegner zieht:
   die Leitung erfährt es, die Spielerin nicht; ein sichtbares Token zieht:
   beide.
2. **Wiederverbinden und Nachholen** (Akzeptanz 2). Das Lebenszeichen wird
   ein benanntes Ereignis (`ping`) statt eines Kommentars, den der Browser
   nicht sieht; die Seite verbindet neu, wenn zwei Lebenszeichen ausblieben,
   und sofort, wenn das Telefon wieder sichtbar oder online wird und das
   letzte Zeichen alt ist. Play, Initiative, Kartenkontext, Zugplaner,
   Seitenleiste und Board fragen bei `reset` neu.
3. **Gleichzeitig auf der Karte** (Akzeptanz 4, REQ-192). Bei 409 führt die
   Karte drei Fassungen zusammen (`mergeEntity`: von wo sie ausging, was
   sie wollte, was jetzt gilt). Berühren sich die Änderungen nicht —
   verschiedene Tokens, Nebel hier und Token dort —, geht das Ergebnis
   gleich nochmals hinaus. Berühren sie sich (dasselbe Token, dasselbe
   Feld), gilt **wer zuerst speicherte**; die Karte lädt den Stand und sagt
   es, wie heute.
4. **E2E mit zwei Sitzungen** (Akzeptanz 1, 5): Leitung und Spielerin in
   zwei Browserkontexten; die Leitung zieht ein Token, die Spielerin sieht
   es ohne Neuladen; Verbindungsabbruch (Kontext offline, wieder online)
   und Nachholen.

## Regel bei Gleichzeitigkeit

- Verschiedene Teile (Kanten, Felder) → **beide gelten**, ohne Rückfrage.
- Derselbe Teil → **wer zuerst speicherte, gilt**; die andere Seite lädt
  neu und sagt „Someone else changed this meanwhile“.
- Ein Ziehen über `POST /api/maps/:id/move` liest am Server und schreibt
  sofort; es kann nicht an einer veralteten Fassung scheitern.

## Offen, nicht in diesem Lauf

- **Mehrere Serverprozesse:** die Quelle ist der Speicher eines Prozesses.
  Mit zwei Prozessen braucht es `LISTEN/NOTIFY` (eine zweite Umsetzung von
  `ChangeFeed`); heute läuft einer, also kein Handlungsbedarf.
- **Durchsickern über die Grösse der Antwort:** bleibt gleich wie bei jeder
  anderen Route.
- **Board mit neu passenden Artikeln:** braucht eine Frage „passt der neue
  Artikel zur Abfrage?“ — gehört zum Laden von Listen (T-398) und bleibt
  dort.

## Stand (28.10.2026, Nachtlauf)

| Schnitt | PR | Prüfung |
|---|---|---|
| 1 Nur melden, was der Empfänger anders sieht | #404 (gemergt) | `apps/server/test/live.test.ts` „keeps quiet …“, zwei Konten am echten Strom |
| 2 Wiederverbinden und Nachholen | #407 | `apps/web/test/live.test.ts` (EventSource aus Speicher, gefälschte Uhr); Server: `ping` ohne Id |
| 3 Zusammenführen auf der Karte | folgt | `apps/web/test/karte-gleichzeitig.test.ts`: zwei Tokens → beide gelten; dasselbe Token → der Erste gilt |
| 4 E2E zwei Sitzungen | folgt | `apps/web/e2e/live-abgleich.spec.ts`, Desktop und Telefon: Zug ohne Neuladen, verborgener Marker kommt nicht an, nach `setOffline` wird nachgeholt |

Nicht angefasst, weil es zum Laden von Listen gehört (T-398): das Board
fragt nach `reset` noch nicht neu, und ein neu passender Artikel
erscheint dort erst beim Neuladen.

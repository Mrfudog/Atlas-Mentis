# Karten: Zeichenebenen, Sperren, Unterkarten

↑ [Technik](Themen/Technik.md) · [Einstieg](README.md)

Stand 2026-09-20. REQ-130 bis 140 und REQ-193 aus
[`VTT/`](../VTT/) in diesem Repo (überholt durch [Datenmodell.md](Datenmodell.md)).

---

## Achtung, ein Wort für zwei Dinge

„Ebene“ heisst in diesem Projekt zweierlei, und wer die beiden verwechselt,
sucht den Fehler an der falschen Stelle:

- **Inhaltsebene** — `Layer`, der Stapel aus
  [Ebenen.md](Ebenen.md). Sie sagt, *welche Artikel es überhaupt gibt*:
  Grundregelwerk, Abenteuer, Hausregeln.
- **Zeichenebene** — ein Blatt auf *einer* Karte. Sie sagt, *was auf dem
  Bild liegt*: Gelände, Beschriftung, Ruinen, Schnee.

Im Schema heissen die zweiten deshalb `sheets` (Kartenblätter) und nicht
`layers`. In der Kartenleiste steht trotzdem „Layers“, weil dort nichts zu
verwechseln ist — man steht auf einer Karte, und eine Inhaltsebene hat auf
ihr nichts zu suchen.

---

## Zeichenebenen

Jedes Blatt trägt ein Hintergrundbild, eine Deckkraft, einen Schalter für
sichtbar und einen dafür, ob es der Spielleitung gehört.

**Das unterste Blatt ist das Kartenbild selbst** (`Map.image`) und hat
keinen Eintrag in `sheets`. Das ist kein Sonderfall aus Bequemlichkeit: an
ihm hängt die natürliche Grösse der Karte, und aus ihr rechnen Nebel, Licht,
Gitter und jede Tokenposition. Eine Karte ohne unterstes Blatt hätte keine
Koordinaten.

Ausblenden lässt es sich trotzdem (`baseHidden`) — wer ein Gelände über eine
Skizze legt, will die Skizze weghaben, ohne sie zu verlieren. Ausgeblendet
heisst dann **durchsichtig und nicht weg**; die Grösse bleibt.

Die Leiste zeigt oben, was obenauf liegt. Gezeichnet wird von hinten nach
vorn, die Liste also rückwärts — eine Reihenfolge, die im Feld anders herum
steht als auf dem Schirm, sortiert früher oder später jemand falsch.

Ein Blatt mit `gmOnly` sieht nur, wer die Karte leitet. In der
Artefakt-Seite hält die Seite es zurück, weil sie keinen Server hat; im
echten Stapel tut es `redactEntity`, bevor es losgeschickt wird.

---

## Sperren: Wand, Tür, Fenster, Abgrund

Eine Liste, zwei Fragen. `Map.walls` hiess einmal „Sichtblocker“ und
war es auch — jede Linie hielt den Blick. Jetzt trägt jede Linie ihre Art:

| Art | Blick | Schritt |
|---|---|---|
| `wall` | hält | hält |
| `door`, zu | hält | hält |
| `door`, offen | lässt durch | lässt durch |
| `window` | lässt durch | hält |
| `chasm` | lässt durch | hält |

Die Art steht **an der Sperre** (`kind`) und nicht in vier Listen, die
dasselbe meinen: wer eine Tür zur Wand macht, ändert ein Feld und nicht den
Ort des Eintrags. Eine Linie ohne `kind` ist eine Wand — was vor den Sorten
gezeichnet wurde, bleibt, was es war.

Ausgewertet wird das an zwei Stellen: `mapWalls` gibt, was den Blick hält,
und füttert damit das Sichtbarkeitspolygon; `mapBarriers` gibt, was den
Schritt hält. Die Bewegung rechnet noch niemand — es gibt kein Zugsystem.
Die Abfrage steht trotzdem, weil eine Tür, die man erst beim Bewegungssystem
als Tür erfasst, bis dahin als Wand gezeichnet wird und die Karte zweimal
gebaut werden muss.

**Gezeichnet werden die Sperren bei jedem Licht**, nicht nur im Dunkeln.
Wer eine Battlemap baut, baut sie am hellen Tag; wären die Wände nur im
Finstern zu sehen, müsste man zum Bauen das Licht ausmachen. Zu sehen sind
sie nur für die Leitung — für alle anderen sind sie der Grund, warum es
dahinter dunkel ist, und sonst nichts.

Am Werkzeug: **ziehen baut, klicken schaltet.** Ein Klick neben eine Tür
macht sie auf oder zu. Eine Tür, die man nur über ein Menü aufbekommt,
bleibt am Tisch zu.

---

## Unterkarten

`insideMap` ist die Kante vom Kind zum Elternteil — gespeichert wird nur
vorwärts, die Karte nennt ihre Umgebung. An der Kante steht der Rahmen
(`x`, `y`, `w`, `h` in Anteilen), also **wo** auf der grossen Karte die
kleine liegt.

Der Rahmen wird mit dem Werkzeug *Sub-map* aufgezogen und nicht in die Mitte
gelegt. Eine Karte, die zeigt, wo sie liegt, ist der halbe Zweck der
Verschachtelung: `world > continent > settlement > district > battle` ist
eine Kette von Rahmen, und ein Klick hinein ist der Zoom.

Alles in Anteilen, nie in Bildpunkten — dieselbe Entscheidung wie bei Nebel
und Tokens. Eine Karte, die neu ausgeschnitten wird, verlöre sonst jeden
Rahmen.

---

## Hineinzoomen statt hineinspringen

Das Rad zoomt. Füllt ein Unterkartenrahmen den Blick — mehr als 55 % in
**beiden** Richtungen; ein Rahmen, der nur quer voll ist, ist ein Streifen
und kein Ziel —, dann wird er aufdringlich: durchgezogen, beschriftet,
„zoom in to enter". **Erst der Schritt danach betritt ihn.**

Zwei Stufen, weil eine Schwelle allein ein Sprung wäre, den niemand kommen
sieht. Und zurück geht es genauso: wer auf einer Unterkarte ganz
hinauszoomt, landet auf der Karte darüber. Ohne das wäre das Hineinzoomen
eine Einbahnstrasse.

Gemessen wird das Sichtfenster, **gerechnet** das Bild. Beim Zeichnen hängt
das neue Bild noch nicht im Baum — es zu messen ergäbe null, und dann wäre
jeder Rahmen winzig, obwohl er den halben Schirm füllt. Die Breite des
Bildes ist ohnehin Zoom mal Fenster; sie auszurechnen ist genauer, als sie
abzulesen. Die Fenstergrösse wird nach jedem Zeichnen gemerkt: sie ändert
sich mit dem Fenster und nicht mit dem Zoom.

**Eine fehlende Messung ist keine Messung von null.** Die Höhe des Fensters
steht nicht immer — beim Zeichnen hängt die Bühne nicht im Baum, und ein
Bild, das noch lädt, gibt ihr keine. Dann zählt die Breite allein. Solange
die Höhe als null in die Rechnung ging, war der Anteil immer null: der
Rahmen sagte nie an, und der Zoomschritt, der ihn hätte ankündigen sollen,
betrat ihn.

---

## Der Kasten ist das Bild

Alles, was in Kartenkoordinaten liegt — Tokens, Gitter, Nebel,
Zeichenebenen, Unterkartenrahmen —, steht in Prozent von `.mapinner`.
Also muss `.mapinner` **genau so gross sein wie das Bild**, und gezoomt
wird der Kasten und nicht das Bild darin.

Es war einmal umgekehrt: der Kasten blieb so breit wie die Bühne
(`min-width:100%`), und das Bild darin wuchs mit dem Zoom. Ein Token bei
`left:50%` sass danach in der Mitte der *Bühne* statt in der Mitte der
Karte — es wanderte beim Hineinzoomen weg von der Stelle, auf die es
gesetzt worden war. Ein Token wächst mit der Karte, weil es eine Fläche
darauf belegt; wandern darf es nicht.

---

## Möbel statt Tokens

Ein Token ist ein Kreis mit einem Rand: jemand steht auf der Karte. Ein
Möbel liegt auf ihr. Die Tokenart `scenery` wird deshalb ohne Kreis,
ohne Rand und ohne Schatten gezeichnet — erst beim Darüberfahren zeigt
es, dass man es anfassen kann.

Dazu zwei Angaben an der Kante:

- `rot` — die Drehung in Grad.
- `ratio` — Höhe geteilt durch Breite. Ohne sie wäre jeder Tisch ein
  Quadrat. Nur `scenery` braucht es; eine Kreatur belegt Felder, kein
  Rechteck.

Beide stehen **an der Kante** und nicht am Asset: dasselbe Fass steht auf
einer Karte quer und auf der nächsten längs, und ein gedrehtes Bild als
eigenes Asset wäre ein zweites Fass. Dieselbe Regel wie beim Lichtradius.

Rechtsklick auf ein Token stellt es ein — Art, Grösse, Drehung,
Seitenverhältnis, Notiz, Licht — und nimmt es nicht mehr sofort weg. Ein
Rechtsklick, der ohne Rückfrage etwas löscht, ist der Klick, den man auf
einem Laptop-Touchpad aus Versehen macht. Der Weg hinaus steht im selben
Dialog, mit Rückfrage.

---

Mit dem Werkzeug *Sub-map* lässt sich ein gesetzter Rahmen auch wieder
anfassen: aus der Mitte heraus ziehen verschiebt ihn, an seiner Ecke ändert
die Grösse, und daneben entsteht ein neuer. Ein Rahmen, den man nur neu
aufziehen kann, wird beim ersten Vertun neu aufgezogen — und die Unterkarte
hängt danach zweimal.

Die Ecke misst in Anteilen und nicht in Bildpunkten: auf einer
herangezoomten Karte wäre eine Ecke von zwanzig Bildpunkten ein Fleck, auf
einer herausgezoomten der halbe Rahmen.

---

## In der Seite (T-115)

Die Seite zeichnet die Karte mit `nw-karte` — auf der Artikelseite
(Layout-Element `map`) und unter **Play** (`/play`). Gerechnet wird in
`packages/model/src/map.ts`, nicht in der Komponente: Blätter
(`drawnSheets`), Gitter und Messen (`gridGeometry`, `measure`), Rahmen
und der Schritt hinein oder hinaus (`frameShare`, `zoomStep`), das
Gruppen-Token (`partyPosition`) und was ein Spieler nicht bekommt
(`redactMap`). Dieselben Regeln wie oben; die Tabelle K1–K7 in
[Datenmodell.md](Datenmodell.md) sagt, wo was steht.

- **Gesten:** ein Finger oder die Maus schwenkt, das Rad und zwei Finger
  zoomen, `+`/`-` auf der Tastatur auch. Ein Marker antippen öffnet seine
  Kurzansicht mit „Open article" — wie jeder genannte Artikel.
- **Play folgt der Sitzung** (`SessionState.activeMap`, `GET /api/play`).
  Wer unter Play in eine Unterkarte zoomt, schaut hinein (`?map=`) — die
  Sitzung und der Beamer bleiben, wo sie sind.
- **Der Stand kommt aus dem Bestand.** Die Karte ist ein Artikel; was
  neben ihr steht (Brotkrumen, Unterkarten, Markerziele, Gruppe), fragt
  `GET /api/maps/:id/context`, neu, sobald der Artikel neu kommt. Über
  den Live-Kanal (T-116) kommt die Karte neu, wenn jemand einen Marker
  setzt; der Kontext, wenn sich eine Karte oder ein Markerziel ändert, und
  Play, wenn die Leitung eine andere Karte auf den Tisch legt.
- **Die Leitung** (und wer die Karte schreibt) zieht Marker an eine neue
  Stelle und setzt neue mit „Add marker" — beides schreibt nur die Kante.
  Gitter, Massstab und Blätter stellt sie in den Feldern der Karte ein.
- **Die Werkzeugleiste** (T-203, nach dem
  [Vergleich mit anderen VTTs](vorschlaege/Karten-VTT-Vergleich.md)):
  links senkrecht, am Telefon waagrecht über der Bühne. Gruppen Auswahl
  (S), Tokens (T, Leitung), Messen (M) und Nebel (F, Leitung); die aktive
  Gruppe zeigt ihre Unterwerkzeuge in einer Zeile über der Karte, noch
  einmal wählen oder Esc führt zurück zur Auswahl. Wände (T-118), Notizen
  und Zeichnen sind in `GRUPPEN` vorgesehen und stehen erst mit ihrem
  Werkzeug da. Die Tasten gelten unter Play, im Vollbild oder mit dem
  Fokus in der Karte, nie beim Tippen. Über der Bühne bleibt, was die
  Sicht einstellt: Zoom, Blätter, Spielersicht, „For“, Vollbild.
- **Vollbild** (Umschalt+F): unter Play geht die ganze Seite ins Vollbild
  (`.vollbild-ziel`), damit der Zugplan dabei bleibt; auf der
  Artikelseite die Karte allein. Ohne Fullscreen API (iPhone) legt sich
  die Karte über die Seite; Esc verlässt beides.

## Karten finden und anlegen (T-202)

Karten haben einen festen Ort: **Play › Maps** (`/maps`) listet jede
Karte, die man sieht, mit Vorschaubild, Unterkarten eingerückt unter ihrer
Karte, gefiltert nach Ebene, Marke und Namen. „New map“ nimmt ein
Kartenbild (hochladen oder wählen) und legt daraus die Karte an — Name aus
dem Bild, Ebene die Schreibebene (`mapFromImage`). Ohne Karten steht dort
gleich die Kurz-Hilfe: *A map is an image with a grid.*

An der Sitzung bietet „Map on the table“ neben Karten auch **Kartenbilder**
an; wer eines wählt, bekommt die Karte dazu, und die liegt dann auf dem
Tisch. Auf der Artikelseite einer Karte steht, in welchen Sitzungen,
Szenen und Kämpfen sie vorkommt („Used in“).

## Nebel in der Seite (T-117)

**Zugedeckt ist alles, was keine aufgedeckte Form berührt** — wie im
Prototyp. `Map.fog` schaltet den Nebel, `Map.reveal` hält, was aufgedeckt
ist; beides steht an der Karte, weil Aufgedecktes bleibt.

- **Formen:** `rect` (aufgezogen), `circle`, `poly` (das Sichtpolygon des
  Prototyps) und `path`, der **Pinselstrich**: ein Linienzug mit Halbmesser
  `r`. Kreis und Strich messen `r` in Anteilen der Breite und tragen das
  Seitenverhältnis `ar`, mit dem sie gezogen wurden — der Server kennt die
  Bildgrösse nicht und muss trotzdem sagen können, ob ein Marker darin
  steht.
- **Werkzeuge der Leitung** (Knopf *Fog*): *Reveal* zieht ein Rechteck auf,
  *Brush* malt in der gewählten Breite (in Feldern), *Hide* deckt zu, was
  mit seiner Mitte im Kasten liegt, dazu *Reveal all* und *Cover all*.
  Ein Finger zieht die Form, zwei zoomen weiter.
- **Entlang des Weges** (*Reveal along moves*): wer ein Token im Nebel
  zieht, deckt den Weg auf — die Leitung so breit wie der Pinsel, ein Zug
  über den Server zwei Felder breit, `for` die gezogene Figur. **Ob, sagt
  die Kampagne** (`Campaign.revealOnMove`, T-204); die Karte darf es
  überschreiben (`Map.revealOnMove`, die Wahl in der Nebelleiste: campaign
  / on / off). Die Bewegung zählt in beiden Fällen; ohne Aufdecken deckt
  die Leitung nachher auf. Wände rechnet die Seite dabei noch nicht — der
  Prototyp nimmt das Sichtpolygon.
- **Je Gruppe oder je Figur** (`Campaign.fog`, T-204): je Gruppe sieht
  jede Spielerin alles Aufgedeckte. Je Figur darf eine Form `for` nennen —
  eine Figur oder eine Gruppe —, und dann sehen sie nur diese, ihre
  Gruppe und die Leitung; was die Leitung ohne Wahl aufdeckt, gilt allen.
  In der Kopfleiste der Karte wählt die Leitung unter *For*, für wen sie
  aufdeckt und wessen Sicht *Player view* zeigt; ohne *Player view* sieht
  sie die Vereinigung.
- **Züge der Spielenden** (`Campaign.moves`, T-204): ausserhalb eines
  Kampfes zieht eine Spielerin ihre eigene Figur, auch wenn sie die Karte
  nicht schreibt (`POST /api/maps/:id/move`). `free` zieht sofort,
  `confirm` legt einen Vorschlag an — gestrichelt vom Token zum Ziel, mit
  ✓ und ✗ für die Leitung, gespeichert als Zugplan mit einem Schritt
  (T-198), live über den Kanal. Im Kampf gilt ohnehin der Zugplan.
- **Gezeichnet auf einer Leinwand** (T-204): der Nebel war ein
  SVG-Rechteck mit `mask="url(#…)"`; unter `<base href="/">` löst nicht
  jeder Browser den Verweis gegen das eigene Dokument auf, und dann deckte
  das Rechteck alles zu — die Spielersicht war schwarz, auch das
  Aufgedeckte. Jetzt deckt eine Leinwand alles zu und schneidet die
  Formen heraus (`karten/nebel.ts`).
- **Zurückgehalten wird am Server** (`redactMap`): Marker unter dem Nebel
  gehen nicht an Spielende, ausser dem Gruppen-Token und den Figuren der
  Gruppe — wer im Dunkeln steht, steht trotzdem auf der Karte. Rahmen von
  Unterkarten nur, wenn ihre Mitte oder eine Ecke aufgedeckt ist. **Das
  Bild selbst** geht ganz hinaus und wird im Browser zugedeckt; ob der
  Server es beschneiden soll, ist E-041. Was wirklich geheim ist, gehört
  auf ein Blatt `gmOnly` — das geht nicht hinaus.
- **Die Leitung sieht halb hindurch.** Mit *Player view* sieht sie die
  Karte, wie Spielende sie bekommen: Nebel deckend, ohne Blätter der
  Leitung, ohne versteckte Marker — dieselbe Rechnung (`redactMap`), im
  Browser, als Vorschau.

## Tokens im Spiel und wer dran ist (T-117)

- **Teilnehmer auf die Karte** (REQ-135): läuft auf dieser Karte ein Kampf
  (die Begegnung, die die Sitzung führt, oder eine laufende mit `onMap`),
  setzt *Place combatants* jeden Teilnehmer ohne Token als Marker
  `kind: play` in die Mitte des Ausschnitts, ein Feld auseinander; die
  Leitung zieht sie an ihren Platz. *Clear play tokens* räumt nach dem
  Kampf auf — Vorbereitetes und die Gruppe bleiben. Wie lange ein
  Spiel-Token lebt (Sitzung, Kampagne, Begegnung), ist E-039.
- **Live:** ein Zug ist eine Änderung der Karte und geht über den
  Live-Kanal an jedes Gerät, gesiebt je Empfänger.
- **Wer dran ist** (REQ-144): ein goldener Ring um das Token des
  Laufenden, ein gestrichelter um das des Nächsten, und in der Zeile
  darunter „Round 2 · Ghoul’s turn · next: Rook". Spielende sehen den
  Ring nur, wo ihre Initiative-Reihe den Teilnehmer zeigt (D53, D58) —
  ein Gegner, dessen Zug noch nicht kam, ist auch nicht „next".
- **Das Tokenbild** ist `Statblock.token` des Statblocks der Kreatur — ein
  Asset der Klasse „Token" (T-119), gesiebt, eine Instanz mit dem Token
  ihrer Vorlage —, sonst ihr Bild (`Image.image`). **Ohne Bild** stehen
  die Anfangsbuchstaben des Namens, den der Server schickt — für Spielende
  ist das der Deckname, solange der Name nicht freigegeben ist (REQ-178,
  `redactEntity`); die Maske entscheidet das nicht.
- **Spielende ziehen die eigene Figur** noch nicht — wer es erlaubt und
  wo das steht, ist E-040.

## Der Zugplan (T-198, Prototyp)

Unter Play steht unter der Karte eine **Aktionsleiste** wie in Baldur's
Gate 3 — ein Prototyp zum Testen, Bedienung vor Vollständigkeit.

- **Ressourcen** oben rechts: ● Aktion, ▲ Bonusaktion, ◆ Reaktion und die
  Bewegung als Balken (`planBudget`, `packages/model/src/zugplan.ts`).
  „Dash" gibt das Tempo noch einmal.
- **Kacheln** rechnet der Server beim Lesen (D8, D51): die Aktionen des
  Statblocks (`composedOf` auf Artikel mit `Action`-Karte, die Art aus
  `Action.actionType`), dazu waffenloser Schlag und die allgemeinen
  Aktionen (Dash, Disengage, Dodge, Help, Hide).
- **Auf der Karte**: *Move* zeigt die erreichbaren Felder im übrigen
  Tempo (5-10-5, andere Tokens besetzt, `planReach`), mit der Maus die
  Wegvorschau mit Fuss; ein Antippen legt den Weg in die Zugfolge. Ein
  Angriff zeigt seine Reichweite als Ring, Ziele in Reichweite rot
  umrandet mit der **Trefferchance** (`hitChance`, natürliche 1 und 20),
  die übrigen blass.
- **Die Zugfolge** liest sich „Move 20 ft → Greataxe → Goblin → Bonus:
  Rage", mit Vorschau (Trefferchance, Schaden, erwarteter Schaden);
  umordnen per Ziehen oder ← →, zwei Wege tauschen nicht.
- **Einreichen und bestätigen**: der Plan geht an die Leitung (Echtzeit
  über den Live-Kanal, Meldung `plan`). Bestätigt sie, würfelt der Server
  Angriff und Schaden ins Log (T-172, kritisch die Würfel doppelt), und das
  Token wandert ans Ende des Weges. Abgelehnt mit Grund geht er zurück.
- **Wer plant:** wer die Figur führt (`app_user_actor`) und ein Token auf
  der Karte hat; die Leitung für jede Kreatur mit Statblock, auch für
  einen Gegner. Die **Rüstungsklasse** eines Ziels sieht nur die Leitung;
  Spielende sehen die Chance.
- **Ein Plan ist Spielgeschehen, kein Inhalt**: er steht im Protokoll
  (`event_log`, `turnplan`, `subject` die Karte), je Änderung ein Eintrag
  mit derselben Plan-Id; es gilt der jüngste. Keine Migration, kein
  Artikel, keine Ausfuhr.

### Runde 2: Gelegenheitsangriffe und kein freies Ziehen

- **Wer bedroht:** die Tokens der Gegenseite mit Statblock, im Kampf nur
  die Teilnehmer. Seiten gibt es zwei: die der Gruppe (Spielerfigur,
  Mitglied einer Gruppe, `participates.ally`) und alle anderen
  (`seiteVon`, `apps/server/src/zugplan.ts`). Die Reichweite ist der
  weiteste Nahkampfangriff, sonst 5 ft.
- **Vor dem Senden:** verlässt ein geplanter Weg (oder die Vorschau) die
  Reichweite eines Gegners, steht ein ⚠ am Feld davor, und der Schritt
  sagt „provokes an opportunity attack from Goblin" (`opportunityAttacks`,
  jeder Gegner einmal je Zug). **Disengage** vor dem Weg hebt es auf.
  Die Felder rechnet die Karte; dem Server schickt der Plan dafür die
  Bildgrösse mit (`nat`).
- **Beim Ausführen** hält der Zug am Feld an, das das Token verlassen
  will (`state: 'reacting'`, `pending`), und fragt, wer reagieren darf —
  die Leitung für Gegner, Spielende für ihre Figur: „Opportunity attack?"
  Ja würfelt den besten Nahkampfangriff am Server ins Log und verbraucht
  die Reaktion (`event_log`, `reaction`); Nein lässt ziehen. Danach geht
  der Zug weiter (`POST /api/maps/:id/turn-plan/:plan/react`).
- **Die Reaktion ist weg bis zum eigenen nächsten Zug** (`reactionBack`,
  nach Runde und Platz in der Reihe); ohne Kampf, bis ein Zug der Figur
  bestätigt ist. Die Leiste zeigt ◆ dann blass, und ein Plan mit einer
  Reaktion geht nicht durch.
- **Kein freies Ziehen im Kampf:** läuft auf der Karte eine Begegnung
  (`encounterOnMap`), lehnt der Server das Schreiben der Karte ab, wenn
  jemand, der nicht leitet, ein Spiel-Token oder das Token eines
  Teilnehmers verschiebt (`zugSperre`, 423). Die Maske sagt es vorher;
  die Leitung zieht weiter und liest „Moved outside the plan." Ausserhalb
  eines Kampfes gilt die Kampagneneinstellung (T-204).

Noch nicht (Folgeaufgaben): weitere Reaktionen (Shield, Counterspell) als
Kacheln, die auf einen Auslöser warten; Waffen aus dem Inventar als
Kacheln, Zauber mit Flächen und Zauberplätzen, Schaden an der Figur
abziehen, Initiative und „wer ist dran" als Bedingung, Hex-Raster, Wände
(`mapBarriers`), Vorteil/Nachteil und Deckung.

## Was noch fehlt

- **Licht, Sperren und Zonen** in der Seite (REQ-140, 193, 208) — der
  Prototyp kann sie, die Seite zeichnet sie noch nicht.
- **Rahmen aufziehen** und Marker einstellen (Art, Grösse, Drehung,
  versteckt) mit der Maus; heute über die Kanten im Bearbeiten.
- **Kacheln** für grosse Karten (REQ-138, `Map.tiles`).
- **Bewegung**, die `mapBarriers` auch auswertet.
- **Mehrere Tokens auf einmal** verschieben.
- **Spielende ziehen die eigene Figur** (E-040), **Lebensdauer** der
  Spiel-Tokens (E-039).

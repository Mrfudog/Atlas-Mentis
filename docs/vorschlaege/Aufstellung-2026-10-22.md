# Aufstellung: alle Wünsche vom 22.10.2026

Was die Leitung in der Sitzung vom 22.10.2026 genannt hat, geordnet nach
Bereich, je Zeile mit:

- **Stand:** erledigt (mit PR), in Arbeit, Konzept oder offen;
- **Feature;**
- **Story:** bestehend und erweitert, oder neu;
- **Aufgabe und Entscheidung** fürs Projektbrett.

Die Nummern schliessen an das Brett an (zuletzt T-358, E-135). Was in
[Konzepte-2026-10-22.md](Konzepte-2026-10-22.md) schon eine Nummer hat,
behält sie.

**Zeichen:**

| Zeichen | Stand |
|---|---|
| ✅ | auf dev |
| 🔁 | PR offen |
| 📝 | Konzept oder Story steht, nicht gebaut |
| ⏳ | offen, wartet auf eine Entscheidung |
| 🐞 | Fehler, noch nicht behoben |

---

## A · Karten: Teilen, Bild, Deckname

| # | Wunsch | Stand | Feature | Story | Aufgabe / Entscheidung |
|---|---|---|---|---|---|
| A1 | Scrollleisten flackern, wenn die Karte die Fläche genau füllt | ✅ #352 | F-055 | REQ-130 (Behebung) | — |
| A2 | *Release* teilt die Karte (ready, campaign) | ✅ #352 | F-055 | REQ-131 (Behebung) | — |
| A3 | Spielende sehen das Kartenbild unter dem Nebel, ohne das Bild einzeln zu teilen | ✅ #352 | F-057 | REQ-139 (Behebung) | — |
| A4 | Deckname gilt; Leitung deckt auf (*Reveal name*), weiteres Wissen teilbar | ✅ #352 | F-012 | **REQ-178** erweitert | — |
| A5 | Spielende sehen nur Karten im Spiel, nie die Vorlage | 🔁 Zwischenstand | F-055 | **REQ-372** neu | T-359 · E-136 entschieden, **E-139** offen (Umgebung) |
| A6 | Tests zur Sichtbarkeit je Rolle (Leitung und Spielerin, verschiedenes Ergebnis) | 📝 | F-080 | REQ-359 erweitert | T-359 |
| A7 | Vorlage und Instanz sichtbar unterscheiden (nur eine „Sewer Hideout“ zu sehen) | 📝 | F-005 | **REQ-371** neu | T-367 · **E-140** offen |

## B · Karten: Sicht, Zeichnen, Zoom

| # | Wunsch | Stand | Feature | Story | Aufgabe / Entscheidung |
|---|---|---|---|---|---|
| B1 | Sicht an einer Schiessscharte: Polygon quer durch Wände | ✅ #355 | F-057 | REQ-139 (Behebung) | — |
| B2 | Rahmen springt bei *Unlink* / *Link shape* in die Unterkarte | ✅ #356 | F-055 | REQ-131 (Behebung) | — |
| B3 | *Link shape* (Polygon) mit Ecken, Einrasten, Lupe, Undo | ✅ #356 | F-061 | REQ-142 erweitert | — |
| B4 | Hineinzoomen nur, wo Zeiger bzw. Mitte des Blicks liegt | 🔁 #358 | F-055 | REQ-131 (Behebung) | — |
| B5 | Zoomtiefe zeigt den jetzigen Stand, „Use current“ | 🔁 #358 | F-055 | REQ-131 | — |
| B6 | Nach vielen Punkten lässt sich die Karte nicht mehr ziehen (Lupe mit der Maus) | 🔁 #358 | F-061 | REQ-142 (Behebung) | — |
| B7 | Punkte zurücknehmen, auch bei Wänden; letzte Änderung zurück | 🔁 #358 | F-061 | REQ-142 | — |
| B8 | **Gesetzte Punkte ziehen**, beim Anlegen und Bearbeiten: Wände, Fenster, Kartenbereiche | 📝 | F-061 | REQ-142 erweitert | **T-370** (schliesst T-368 ein: Ecken gespeicherter Formen) |
| B9 | Tools-Editor in der Kartenleiste: Häkchen und sichtbare Werkzeuge stimmen nicht überein | 🐞 | F-055 | REQ-131 (Behebung) | **T-371** |
| B10 | Shift/Alt/Ctrl beim Zeichnen; Leiste mit Hilfe und Kürzeln | 📝 #353 | F-061, F-054 | **REQ-373** neu | T-372 · **E-145** offen |

**B9 im Einzelnen:** Die Häkchen zeigen die Einstellung der Kampagne
(`Campaign.mapTools`). Die Leiste zeigt aber mehr, und die Namen und die
Aufteilung der Gruppen passen nicht zusammen:

- Ist der Nebel an, steht *Fog* in der Leiste, auch wenn das Häkchen fehlt;
  dasselbe gilt für *Light* auf einer dunklen Karte.
- *Tokens* erscheint, sobald eines von Tokens, Markers oder Assets an ist.
- *Notes* hängt an Markers.
- Measure und Floors lassen sich gar nicht einstellen.
- Eine Karte ohne Art zeigt „Tools on  maps“.

**Vorschlag:** ein Häkchen je Gruppe der Leiste, mit denselben Namen. Was
die Karte erzwingt, steht als gesetztes, gesperrtes Häkchen mit Grund da
(„on: fog is on on this map“). Eine Karte ohne Art fragt nach der Art.

## C · Karten: Stufen, Bereiche, Übergänge

| # | Wunsch | Stand | Feature | Story | Aufgabe / Entscheidung |
|---|---|---|---|---|---|
| C1 | Unterkarte **auch von unten** einstellen (an der tieferen Karte, nicht nur an der oberen) | 📝 | F-055 | **REQ-131** erweitert | **T-373** |
| C2 | Tokens zwischen Stufen: nach oben/unten mitnehmen oder nicht, je Verknüpfung | 📝 | F-056 | **REQ-374** neu (baut auf T-328 auf) | **T-374** |
| C3 | **Übergang** zwischen Stufen: Rand weich (Stärke), Form nachbessern, Masken (nur Teile übernehmen) | 📝 | F-055 | **REQ-375** neu | **T-375** · **E-146** offen |
| C4 | Die Karte darüber und angrenzende Karten **um** die Unterkarte zeigen; die tiefere Karte hat selbst eine Form | 📝 | F-055 | **REQ-375** | T-375, mit E-121 (Nachbarkarten) |
| C5 | Der Rand der Karte darüber ist „verloren“ | ⏳ Einstellung | F-055 | REQ-131 | **T-376** |
| C6 | Darstellung der Verknüpfung: Titel, besserer Rand, je Betrachter | 📝 | F-055 | **REQ-131** erweitert | T-376 |
| C7 | **Kartenbereiche** generisch: Bezirk, Fraktionsgebiet, Biom, Suchgebiet; die Verknüpfung ist ein Untertyp davon | 📝 | F-059 | **REQ-193** erweitert, **REQ-376** neu | **T-377** · **E-147** offen |
| C8 | Massstäbe und Einheiten überarbeiten | 📝 | F-049 | **REQ-377** neu | **T-378** |
| C9 | Kartenerstellung nach Inkarnate, Elemente als Information (Schleichwege) | 📝 | F-061 | **REQ-143** erweitert | — (später) |
| C10 | Ecken gespeicherter Formen verschieben | 📝 | F-061 | REQ-142 | in T-370 |

**C5 im Einzelnen:** Der Rand ist nicht durch eine Änderung im Code
verschwunden. Die Vorgabe der Kampagne steht auf `outer: none`, und an
*Vallejy* steht die Verknüpfung ausdrücklich auf `none`. Eingeschaltet wird
er heute mit *faded*, je Verknüpfung oder als Vorgabe der Kampagne.

**T-376** macht das sichtbar:

- *Faded* wird die Vorgabe.
- Die Einstellung steht dort, wo man die Unterkarte öffnet (C1).
- Der Rand bekommt Titel und Kante nach Betrachter (C6).

**C3/C4 als ein Gedanke:** Jede Kartenstufe hat eine **Form** (ein
Kartenbereich, C7). Um sie herum wird gezeigt, was darüber liegt (die Karte
darüber) und was daneben liegt (Nachbarkarten, E-121). Zwischen den beiden
liegt ein **Übergang**:

- weich, mit einstellbarer Breite;
- oder hart, mit Kante in Farbe und Stärke;
- dazu eine **Maske**, die nur Teile der Unterkarte übernimmt.

Gespeichert wird es an der Kante `insideMap` und an der Nachbarkante; das
Bild wird nie verändert (D8).

**C7 im Einzelnen:** Heute gibt es zwei Dinge:

- **Gebiete** (REQ-193, `territory`), die Herrschaftsgebiete zeigen;
- **Verknüpfungen** mit Form (Link shape).

Vorschlag (**E-147**): Ein **Kartenbereich** ist eine Form auf einer Karte
mit Art (district, faction territory, biome, search area, link, …), Name,
Sichtbarkeit und optionalem Ziel.

- Eine Verknüpfung ist ein Kartenbereich der Art *link* mit Ziel Karte.
- Ein Suchgebiet ist ein Kartenbereich mit Ziel Auftrag.
- Die Arten sind eine Liste (Sorten als Listen, E-142).

Ob ein Bereich ein eigener Artikel ist oder eine Kante mit Form, ist der
Kern der Entscheidung. Vorschlag: eine **Kante** `area` von der Karte zum
Ziel, mit Form an der Kante, so wie `insideMap` heute; ohne Ziel ein
Eintrag an der Karte (wie die Form auf einem Board). Wer einen Bezirk
beschreiben will, legt einen Ort an und zeigt mit dem Bereich auf ihn.

## D · Spieltisch, Boards, Zeigen

| # | Wunsch | Stand | Feature | Story | Aufgabe / Entscheidung |
|---|---|---|---|---|---|
| D1 | Drei Boards: Kampagne, Spieler, Spiel | 📝 #354 | F-067, F-052 | REQ-119 erweitert, **REQ-362** | — · E-136 bis E-138 eingetragen |
| D2 | Boards einfach wechseln | 📝 #354 | F-025 | **REQ-364** | — |
| D3 | Etwas zeigen, Ansicht erzwingen; Popup, auf das Spielerboard nehmen | 📝 #354 | F-052 | **REQ-363** | T-369 · E-138 entschieden |
| D4 | Linkleiste je Spieler (Karussell, konfigurierbar, mit Hilfe) | 📝 #353 | F-054 | **REQ-373** | T-372 · E-145 |
| D5 | Spielansicht ab Kampagnenstart neu durchgehen | ⏳ | F-029 | — | nach D1 |

## E · Figuren, Rechte, Verwaltung

| # | Wunsch | Stand | Feature | Story | Aufgabe / Entscheidung |
|---|---|---|---|---|---|
| E1 | Freigaben an der Figur (sehen, spielen, bearbeiten), Rahmen durch die Kampagne | 📝 | F-012 | **REQ-369** | T-365 · E-137 entschieden |
| E2 | Spielende sehen, was ihre Tokens sehen | ✅ teils (T-216) | F-057 | REQ-369 | in T-365 |
| E3 | Verwaltung: Konten, Kampagnen samt Zuweisung, Inhalte je Konto | 📝 | F-010 | **REQ-367**, REQ-229 | T-363 · E-144 |
| E4 | Immer eine laufende Kampagne oder Schreibebene; Spielstand in die Ebene der Sitzung | 📝 | F-004 | **REQ-368** | T-364 |

## F · Inhalte, Ebenen, Erstellung

| # | Wunsch | Stand | Feature | Story | Aufgabe / Entscheidung |
|---|---|---|---|---|---|
| F1 | Instanzierung: drei Muster (Fassung, Spielstand, Stück) | 📝 | F-005 | **REQ-371** | T-367 · E-140 |
| F2 | Settings modular, nicht nur an Büchern | 📝 | F-004 | **REQ-100** erweitert | T-361 · E-141 |
| F3 | Artikel in eine andere Ebene schieben (Werkbank) | 📝 | F-016 | **REQ-365** | T-360 |
| F4 | Sorten als Listen, erweiterbar im Feld | 📝 | F-003 | **REQ-366** | T-362 · E-142 |
| F5 | Assets ohne idea/ready | 📝 | F-062 | **REQ-370** | T-366 · E-143 |
| F6 | **Erstellungsprozess:** Vorgabe-Stand nach Regeln (Art, Ebene), Pflicht- und Kann-Felder in der Schnellanlage | 📝 | F-022 | **REQ-378** neu | **T-379** · **E-148** offen |

**F6 im Einzelnen:**

- **Vorgabe-Stand nach Regeln:** Eine Regel an der Kampagne nennt je Art
  oder Ebene, mit welchem Stand ein neuer Artikel entsteht. Beispiele:
  Spielstände `ready`, Ideen `idea`, alles in der Spielerebene `prepared`.
  Die genaueste Regel gilt, wie bei der Sichtbarkeit (T-252).
- **Schnellanlage je Art:** Welche Felder dort stehen, steht an der Art,
  so wie heute `prominent` und `alwaysEdit` am Feld (`quickCreate:
  'required' | 'offered'`). Die Maske zeigt Pflichtfelder offen, Kann-Felder
  unter „+ Add field“.
- **E-148** fragt, ob die Regel für den Stand an die Kampagne oder an die
  Ebene gehört. Vorschlag: an die Kampagne, mit der Ebene als
  Bedingung.

---

## Neue Stories (in diesem Zweig angelegt)

| Story | Titel | Feature |
|---|---|---|
| REQ-373 | Werkzeugleiste mit Belegungen, Hilfe und Kürzeln | F-054 |
| REQ-374 | Tokens zwischen Kartenstufen | F-056 |
| REQ-375 | Kartenstufen ineinander übergehen lassen | F-055 |
| REQ-376 | Kartenbereiche | F-059 |
| REQ-377 | Massstäbe und Einheiten der Karte | F-049 |
| REQ-378 | Anlegen nach Regeln: Stand und Felder | F-022 |

Erweitert: REQ-131 (von unten einstellen, Darstellung, Rand als Vorgabe),
REQ-142 (Punkte ziehen und zurücknehmen), REQ-143 (Elemente als
Information), REQ-193 (Bereiche als Obergriff).

## Fürs Projektbrett (neu ab hier)

| Nr. | Aufgabe | Story |
|---|---|---|
| T-370 | Gesetzte Punkte ziehen (Entwurf und gespeicherte Formen, auch Bereiche) | REQ-142 |
| T-371 | Tools-Editor: ein Häkchen je Gruppe, Erzwungenes mit Grund | REQ-131 |
| T-372 | Leiste mit Belegungen (Vorschlag #353) | REQ-373 |
| T-373 | Verknüpfung von unten einstellen | REQ-131 |
| T-374 | Tokens zwischen Stufen je Verknüpfung | REQ-374 |
| T-375 | Übergang, Form der tieferen Karte, Umgebung, Masken | REQ-375 |
| T-376 | Rand als Vorgabe, Titel und Kante je Betrachter | REQ-131 |
| T-377 | Kartenbereiche (Bereich als Obergriff, Verknüpfung als Art) | REQ-376, REQ-193 |
| T-378 | Massstäbe und Einheiten | REQ-377 |
| T-379 | Anlegen nach Regeln | REQ-378 |

| Nr. | Frage | Vorschlag |
|---|---|---|
| E-145 | Tastenbild: Shift in Stufen, Alt frei, Ctrl weiter | #353 |
| E-146 | Übergang zwischen Stufen: an der Kante `insideMap`, Masken als Form, Bild unverändert | §C |
| E-147 | Kartenbereich als Kante mit Form, Verknüpfung als Art davon | §C |
| E-148 | Vorgabe-Stand: Regel an der Kampagne mit Ebene als Bedingung | §F |

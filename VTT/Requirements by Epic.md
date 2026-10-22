---
tags: [vtt, requirements, view]
status: derived
updated: 2026-10-22
---

# Requirements by Epic

> [!info] Erzeugt aus den Notizen
> Quelle sind die Story-Notizen in `VTT/Stories/`, die Features in `VTT/Features/`, die Epics in `VTT/Epics/`.
> `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md` schreibt diese Seite neu — von Hand geändert wird die Notiz, nicht die Seite.

Sprung: [[#EP-01 Inhaltsgerüst]] · [[#EP-02 Zugang & Betrieb]] · [[#EP-03 Kreaturen & Figuren]] · [[#EP-04 Spielererlebnis]] · [[#EP-05 Kampagne & Sitzungen]] · [[#EP-06 Welt & Lore]] · [[#EP-07 Regeln & Nachschlagen]] · [[#EP-08 Live-Spiel]] · [[#EP-09 Karten]] · [[#EP-10 Medien & Assets]] · [[#EP-11 Oberfläche & Navigation]] · [[#EP-12 Import & Inhalte]]

## EP-01 Inhaltsgerüst

56 Stories · 190 Punkte · 33 steht · 10 teils · 7 offen · 4 ersetzt · 2 verworfen — [[EP-01 Inhaltsgerüst]]

### F-001 Artikelmodell

Peg, Karten je Art, Kanten, Bezeichner — wie ein Artikel gespeichert wird. — [[F-001 Artikelmodell]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-001]] | Artikel aus Arten, Feldern und Kanten | Spielleitung | 1 | 5 | steht |
| [[REQ-002]] | Nachfolgerkette | – | 1 | 2 | ersetzt |
| [[REQ-010]] | Feldgruppen nur, wo sie gebraucht werden | Spielleitung | 1 | 3 | steht |
| [[REQ-011]] | Inhaltsblock als eigenes Grundelement | – | 1 | 5 | ersetzt |
| [[REQ-016]] | Übersetzungsschicht für Begriffe | – | 1 | 3 | verworfen |
| [[REQ-019]] | Rohform jedes Imports aufbewahren | – | 1 | 2 | verworfen |
| [[REQ-163]] | Bezeichner ohne Bedeutung | Spielleitung | 1 | 1 | steht |
| [[REQ-181]] | Freie Felder an einem einzelnen Artikel | Spielleitung | 2 | 3 | steht |
| [[REQ-182]] | Kanten lesen sich von beiden Enden | Spielleitung | 2 | 1 | steht |

### F-002 Register

Die Seite /registry: Typen, Felder, Kanten, Listen und Ansichten anlegen und ändern, mit Zählung vorher. — [[F-002 Register]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-230]] | Register in der Seite bearbeiten | Spielleitung | 2 | 5 | steht |
| [[REQ-265]] | Register zeigt einen Typ auf einer Fläche | Spielleitung | 2 | 3 | steht |
| [[REQ-260]] | Ausgehende Kanten im Register sehen | Spielleitung | 3 | 1 | steht |
| [[REQ-262]] | Flache Typenlisten | Spielleitung | 3 | 1 | steht |
| [[REQ-263]] | Was eine Einstellung im Register auslöst | Spielleitung | 3 | 1 | steht |
| [[REQ-027]] | Arten ohne Code anlegen | Spielleitung | 4 | 13 | steht |

### F-003 Feldformen & Aufzählungen

Was ein Feld halten darf: Formen, Aufzählungszeilen, Spannen, Verweisziele, Vorgaben, freie Sorten. — [[F-003 Feldformen & Aufzählungen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-012]] | Textfelder für jede Art von Text | Spielleitung | 2 | 2 | steht |
| [[REQ-023]] | Status idea/planned/used/discarded | – | 2 | 1 | ersetzt |
| [[REQ-258]] | Verweisfeld nennt, welche Artikel es annimmt | Spielleitung | 2 | 2 | teils |
| [[REQ-261]] | Sorte einer Art als freies Feld mit Vorschlägen | Spielleitung | 2 | 1 | steht |
| [[REQ-366]] | Sorten als Listen | Spielleitung | 2 | 5 | offen |
| [[REQ-259]] | Vorgabewerte für Felder | Spielleitung | 3 | 1 | steht |

### F-004 Ebenen & Stapel

Ebenen, Gruppen von Ebenen, Herausgeber, Aufschalten (auch teilweise) und was im Stapel einer Kampagne steht. — [[F-004 Ebenen & Stapel]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-004]] | Ebenen als Pakete von Inhalt | Spielleitung | 1 | 3 | steht |
| [[REQ-005]] | Zugehörigkeit eines Artikels zu einer Ebene | Spielleitung | 1 | 3 | steht |
| [[REQ-006]] | Stapel: was in der Kampagne gilt | Spielleitung | 1 | 5 | teils |
| [[REQ-100]] | Welt als Ebene | Spielleitung | 1 | 2 | teils |
| [[REQ-348]] | Ebene am Artikel immer sichtbar | Spielleitung | 1 | 3 | steht |
| [[REQ-044]] | Herkunft am Artikel sehen | Spielleitung | 2 | 5 | steht |
| [[REQ-102]] | Artikel je Stapel und Wissen zeichnen | Spieler | 2 | 5 | teils |
| [[REQ-244]] | Ebenen gruppieren | Spielleitung | 2 | 3 | steht |
| [[REQ-245]] | Ebenen beschreiben sich selbst | Spielleitung | 2 | 2 | steht |
| [[REQ-249]] | Ebenen nach Herausgeber | Spielleitung | 2 | 3 | teils |
| [[REQ-255]] | Ebenen teilweise aufschalten | Spielleitung | 2 | 3 | steht |
| [[REQ-368]] | Immer eine laufende Kampagne oder Schreibebene | Spielleitung | 2 | 3 | offen |
| [[REQ-007]] | Stapel für Fortgeschrittene | Spielleitung | 3 | 5 | offen |
| [[REQ-045]] | Ebenen-Aktionen am Artikel | Spielleitung | 3 | 8 | offen |
| [[REQ-253]] | Ebenen und Artikel kopieren | Spielleitung | 3 | 5 | offen |

### F-005 Fassungen & Varianten

Dieselbe Sache aus einer anderen Quelle (Fassung, Überschreibung) und eine verwandte Sache (Variante); Vergleichsebenen. — [[F-005 Fassungen & Varianten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-008]] | Varianten einer Sache | Spielleitung | 1 | 2 | teils |
| [[REQ-009]] | Überschreiben in der eigenen Ebene | Spielleitung | 2 | 3 | steht |
| [[REQ-264]] | Vergleichsebenen der Kampagne | Spielleitung | 2 | 3 | teils |
| [[REQ-310]] | Fassungen am Feld zeigen | Spielleitung | 2 | 3 | steht |
| [[REQ-371]] | Vorlage, Spielstand und Stück verständlich | Spielleitung | 2 | 5 | offen |
| [[REQ-108]] | Lore der Kampagne abweichen lassen | Spielleitung | 3 | 3 | steht |

### F-006 Ansichten & Anordnung

Overview, Quick, Full, Print, Search und eigene Ansichten; Anordnung am Typ, ohne Code. — [[F-006 Ansichten & Anordnung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-026]] | Ansichten festlegen | Spielleitung | 1 | 3 | steht |
| [[REQ-256]] | Ansichten ohne Code definieren | Spielleitung | 1 | 8 | steht |
| [[REQ-164]] | Darstellungsstufen als eigenes System | – | 2 | 3 | ersetzt |

### F-007 Verweise & Platzhalter

[[Verweise]] nach Nummer, Rückbezüge, {VAR}-Platzhalter, Regelverweise im Text. — [[F-007 Verweise & Platzhalter]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-013]] | Verweise nach Nummer, getippt nach Name | Spielleitung | 1 | 5 | teils |
| [[REQ-341]] | Glossar: Begriffe im Text nachschlagen | Spieler | 1 | 5 | steht |
| [[REQ-174]] | Regeltexte mit Platzhaltern | Spielleitung | 2 | 3 | steht |
| [[REQ-014]] | Rückbezüge sehen | Spielleitung | 3 | 2 | steht |
| [[REQ-175]] | Regelbegriffe im Text erkennen | Spieler | 3 | 2 | steht |
| [[REQ-176]] | Ähnliches vor dem Anlegen vorschlagen | Spielleitung | 3 | 3 | teils |

### F-008 Kanten verstehen

Was eine Kante bedeutet und bewirkt; Typdiagramm und Graph. — [[F-008 Kanten verstehen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-257]] | Kanten verständlich | Spielleitung | 2 | 5 | steht |
| [[REQ-015]] | Graph der Artikel | Spielleitung | 4 | 5 | offen |

### F-009 Verlauf & gleichzeitiges Schreiben

Änderungsverlauf, Revisionen, nichts still überschreiben. — [[F-009 Verlauf & gleichzeitiges Schreiben]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-003]] | Änderungsverlauf je Artikel | Spielleitung | 1 | 3 | teils |
| [[REQ-191]] | Nichts still überschreiben | Spielleitung | 1 | 2 | steht |
| [[REQ-192]] | Gleichzeitig bearbeiten ohne Verlust | Spielleitung | 2 | 3 | steht |

## EP-02 Zugang & Betrieb

47 Stories · 152 Punkte · 28 steht · 5 teils · 11 offen · 1 ersetzt · 2 verworfen — [[EP-02 Zugang & Betrieb]]

### F-010 Anmeldung & Konten

Passwort je Konto, Einladungen, Kontoverwaltung in der Seite, Demo. — [[F-010 Anmeldung & Konten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-031]] | Anmelden mit Passwort | Spieler | 1 | 2 | steht |
| [[REQ-033]] | Konten | Verwaltung | 1 | 2 | steht |
| [[REQ-034]] | Einladen per Link | Spielleitung | 2 | 2 | steht |
| [[REQ-367]] | Verwaltung: Konten, Kampagnen und Inhalte | Verwaltung | 2 | 8 | offen |
| [[REQ-229]] | Konten in der Seite verwalten | Verwaltung | 3 | 2 | offen |
| [[REQ-032]] | Anmeldung über Nextcloud/OIDC | – | 4 | 5 | verworfen |
| [[REQ-228]] | Verlorene Einladung neu ausgeben | Spielleitung | 4 | 1 | offen |
| [[REQ-266]] | Demo-Zugang | Verwaltung | 5 | 3 | offen |

### F-011 Rollen je Kampagne

gm, co-gm, player, spectator am Konto je Kampagne; Verwaltung der Installation. — [[F-011 Rollen je Kampagne]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-035]] | Rolle je Kampagne | Verwaltung | 1 | 3 | steht |
| [[REQ-036]] | Leitung, Spieler und Verwaltung | Verwaltung | 1 | 1 | steht |
| [[REQ-037]] | Mitleitung und Zuschauer | Spielleitung | 3 | 2 | steht |

### F-012 Sichtbarkeit & Wissen

Wer einen Artikel sieht (audience, revealedTo, hiddenFrom) und welche Felder darin (Information, Wissen, Deckname). — [[F-012 Sichtbarkeit & Wissen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-038]] | Wer einen Artikel sieht | Spielleitung | 1 | 2 | steht |
| [[REQ-350]] | Eine Information gilt für eine Gruppe von Artikeln | Spielleitung | 1 | 3 | steht |
| [[REQ-351]] | Wissen über Herkunft, Hintergrund, Klasse und Talent | Spielleitung | 1 | 3 | steht |
| [[REQ-352]] | Reiter Knowledge am Artikel | Spielleitung | 1 | 3 | steht |
| [[REQ-353]] | Die Seite eines Wissens zeigt alles, was es vereint | Spieler | 1 | 3 | steht |
| [[REQ-040]] | Wissen zuteilen | Spielleitung | 2 | 3 | steht |
| [[REQ-156]] | Sichtbarkeit vererben | – | 2 | 2 | verworfen |
| [[REQ-177]] | Einzelne Felder freigeben | Spielleitung | 2 | 3 | steht |
| [[REQ-203]] | Wissen nach Rang in einer Fraktion | Spielleitung | 2 | 2 | steht |
| [[REQ-354]] | Wissenspunkte bei eigener Herkunft und eigenem Hintergrund | Spieler | 2 | 3 | offen |
| [[REQ-369]] | Freigaben an der eigenen Figur | Spieler | 2 | 5 | offen |
| [[REQ-039]] | Sichtbarkeit mit Rollenlisten und Freigabemarken | – | 3 | 8 | ersetzt |
| [[REQ-059]] | Wissen über Arten von Kreaturen | Spielleitung | 3 | 3 | steht |
| [[REQ-178]] | Decknamen | Spielleitung | 3 | 1 | steht |
| [[REQ-179]] | Zeigen, dass es mehr gibt | Spieler | 4 | 1 | steht |

### F-013 Schreibrechte & Freigabe

Wer was schreibt (je Ebene, eigene Artikel), Status ready als Freigabe, gesperrte Felder. — [[F-013 Schreibrechte & Freigabe]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-316]] | Eigene Ebene je Spieler als Vorgabe | Spieler | 1 | 3 | steht |
| [[REQ-041]] | Wer was schreiben darf | Spielleitung | 2 | 3 | teils |
| [[REQ-237]] | Spielende legen Artikel an, die Leitung gibt frei | Spieler | 2 | 5 | steht |
| [[REQ-242]] | Felder der eigenen Figur sperren | Spielleitung | 3 | 5 | offen |
| [[REQ-042]] | Schreibrecht je Feldgruppe | Spielleitung | 4 | 5 | offen |

### F-014 Sicht eines Spielers

Die Leitung sieht die Seite, wie ein bestimmtes Konto sie sieht. — [[F-014 Sicht eines Spielers]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-241]] | Die Sicht eines Spielers einnehmen | Spielleitung | 1 | 5 | steht |

### F-015 API-Tokens & Werkzeugzugang

Tokens am Konto für Skripte und Claude-Sitzungen. — [[F-015 API-Tokens & Werkzeugzugang]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-234]] | API-Tokens für Werkzeuge | Verwaltung | 3 | 2 | steht |
| [[REQ-268]] | Dev-Token aus der Werkbank erzeugen | Verwaltung | 3 | 1 | teils |

### F-016 Werkbank

Prüfungen über den Bestand, Massenänderungen mit Vorschau und Rückgängig (/werkbank). — [[F-016 Werkbank]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-365]] | Artikel in eine andere Ebene schieben | Spielleitung | 2 | 2 | offen |
| [[REQ-088]] | Massenänderungen an Wissen und Rechten | Spielleitung | 3 | 3 | teils |
| [[REQ-235]] | Werkbank: Prüfungen und Massenänderungen | Spielleitung | 3 | 5 | steht |

### F-017 Ausrollen & Sicherung

CI/CD nach Hetzner, dev und prod, Sicherungen, Spiegelung, Netz. — [[F-017 Ausrollen & Sicherung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-154]] | Ausrollen nach dev und prod | Verwaltung | 1 | 3 | steht |
| [[REQ-155]] | Sicherungen | Verwaltung | 2 | 2 | steht |
| [[REQ-269]] | Ankündigen, wann produktiv gearbeitet werden kann | Verwaltung | 2 | 1 | teils |
| [[REQ-199]] | Produktionsdaten nach dev spiegeln | Verwaltung | 3 | 3 | steht |
| [[REQ-267]] | Eigenes Netz-VPS mit VPN | Verwaltung | 5 | 3 | offen |

### F-018 Übernahme dev ↔ prod

Artikel auf dev vorbereiten und nach prod übernehmen, Konflikte lösen. — [[F-018 Übernahme dev - prod]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-270]] | Artikel von dev nach prod übernehmen | Spielleitung | 2 | 5 | teils |
| [[REQ-271]] | Konflikte bei der Übernahme nebeneinander lösen | Spielleitung | 3 | 5 | offen |

### F-019 Leistung & Laden

Listen am Server, schnelle Navigation, Ladeanzeige. — [[F-019 Leistung & Laden]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-246]] | Navigation ohne Einfrieren | Spieler | 1 | 5 | steht |
| [[REQ-232]] | Listen rechnet der Server | Spieler | 2 | 5 | steht |

### F-080 Qualität & Tests

Drei Teststufen für jede Änderung — Unit, Integration, E2E im Browser — und wie das CI sie fährt. — [[F-080 Qualität & Tests]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-359]] | Jede Änderung im Browser geprüft | Verwaltung | 1 | 5 | steht |

## EP-03 Kreaturen & Figuren

30 Stories · 127 Punkte · 18 steht · 2 teils · 9 offen · 1 ersetzt — [[EP-03 Kreaturen & Figuren]]

### F-020 Kreatur

Die Artikelart Creature mit kind, Beziehungen, Begleitern. — [[F-020 Kreatur]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-046]] | Kreatur und Statblock getrennt | Spielleitung | 1 | 3 | steht |
| [[REQ-050]] | Kreatur auf einen Blick | Spielleitung | 2 | 3 | steht |
| [[REQ-060]] | Begleiter und Beschwörungen | Spieler | 3 | 2 | teils |
| [[REQ-105]] | NSC-Verzeichnis | Spielleitung | 3 | 2 | steht |

### F-021 Statblock

Die Zahlen einer Kreatur, aus Regeln zusammengesetzt; Vorlage und Instanz. — [[F-021 Statblock]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-272]] | Statblock als Instanz einer Vorlage | Spielleitung | 1 | 3 | steht |
| [[REQ-053]] | Statblock aus Regeln zusammensetzen | Spielleitung | 2 | 5 | steht |
| [[REQ-054]] | Kampfrolle am Statblock | Spielleitung | 2 | 1 | steht |
| [[REQ-052]] | Statblock lesen wie im Buch | Spielleitung | 3 | 3 | steht |
| [[REQ-055]] | Merkmale beim Tippen wiederverwenden | Spielleitung | 3 | 3 | offen |
| [[REQ-058]] | Monster skalieren | Spielleitung | 5 | 5 | offen |
| [[REQ-062]] | Statblöcke anderer Regelsysteme | Spielleitung | 5 | 8 | offen |

### F-022 Schnellanlage

Kreatur und Statblock in einem Schritt anlegen. — [[F-022 Schnellanlage]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-048]] | Kreatur schnell bearbeiten | Spielleitung | 2 | 3 | steht |
| [[REQ-049]] | Kreatur schnell anlegen | Spielleitung | 2 | 2 | steht |
| [[REQ-378]] | Anlegen nach Regeln: Stand und Felder | Spielleitung | 2 | 5 | offen |

### F-023 Charakterbogen

Der Bogen einer Figur: Allgemein, Kampf, Zauber, Freispiel, schnelle Änderungen. — [[F-023 Charakterbogen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-343]] | Konzentration und Zustandsdauer in der Statuszeile | Spieler | 1 | 3 | steht |
| [[REQ-344]] | Gesperrte Aktionen bleiben sichtbar, mit Grund | Spieler | 1 | 3 | teils |
| [[REQ-051]] | Schnelle Änderungen am Bogen | Spieler | 2 | 3 | steht |
| [[REQ-063]] | Charakterbogen: Allgemein | Spieler | 2 | 5 | steht |
| [[REQ-066]] | Charakterbogen: Kampf | Spieler | 3 | 5 | steht |
| [[REQ-067]] | Charakterbogen: Zauber | Spieler | 3 | 5 | steht |
| [[REQ-068]] | Charakterbogen: Freispiel | Spieler | 4 | 3 | offen |
| [[REQ-073]] | Eigene Anordnung des Bogens je Nutzer | – | 4 | 5 | ersetzt |

### F-024 Charaktermanager

Figur geführt erstellen und steigern: Klasse, Herkunft, Hintergrund, Wahlen, Attribute, Ausrüstung, Sprachen. — [[F-024 Charaktermanager]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-238]] | Figur aus den Artikeln erstellen | Spieler | 1 | 13 | steht |
| [[REQ-251]] | Sprachen der Kampagne | Spielleitung | 1 | 2 | steht |
| [[REQ-250]] | Startausrüstung je Kampagne | Spielleitung | 2 | 5 | steht |
| [[REQ-273]] | Eigene Verfahren für Attributswerte | Spielleitung | 2 | 2 | steht |
| [[REQ-274]] | Charakter- und Kampagnenmanager jederzeit aufrufen | Spieler | 3 | 5 | offen |
| [[REQ-056]] | Kreaturen-Baukasten | Spielleitung | 4 | 13 | offen |
| [[REQ-057]] | Punktekauf für Attribute | Spieler | 4 | 2 | offen |
| [[REQ-222]] | Stufenaufstieg mit Wahlen | Spieler | 4 | 5 | offen |

## EP-04 Spielererlebnis

43 Stories · 112 Punkte · 7 steht · 9 teils · 27 offen — [[EP-04 Spielererlebnis]]

### F-025 Spieleransicht & Telefon

Die Seite aus Sicht der Spielenden, auch am Telefon. — [[F-025 Spieleransicht & Telefon]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-069]] | Am Telefon spielen | Spieler | 1 | 3 | teils |
| [[REQ-346]] | Was die Kampagne meiner Figur gezeigt hat | Spieler | 1 | 3 | teils |
| [[REQ-364]] | Zwischen den Boards wechseln | Spieler | 1 | 3 | offen |
| [[REQ-311]] | Spieleransicht mit der eigenen Figur im Fokus | Spieler | 2 | 5 | teils |
| [[REQ-074]] | Schnellzugriffe | Spieler | 3 | 1 | teils |
| [[REQ-194]] | Untere Leiste am Telefon wählen | Spieler | 4 | 1 | offen |

### F-026 Inventar

Liste und Raster, Behälter und Zonen, Ausrüstungsfigur, Ziehen und Verstauen, Gruppeninventar, Gegenstände als Instanz. — [[F-026 Inventar]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-064]] | Inventar als Liste | Spieler | 2 | 3 | steht |
| [[REQ-275]] | Erhaltene Gegenstände als Instanz | Spieler | 2 | 3 | teils |
| [[REQ-320]] | Formen frei malen, auch nicht rechteckig | Spielleitung | 2 | 2 | offen |
| [[REQ-321]] | Stapel im Raster | Spieler | 2 | 3 | offen |
| [[REQ-322]] | Besondere Zonen mit eigenen Regeln | Spieler | 2 | 3 | offen |
| [[REQ-323]] | Alle möglichen Plätze eines Gegenstands | Spieler | 2 | 3 | offen |
| [[REQ-324]] | Hände als Plätze mit Regeln | Spieler | 2 | 3 | offen |
| [[REQ-325]] | Gegenstandsartikel im Detailbereich | Spieler | 2 | 1 | offen |
| [[REQ-326]] | Ziehen und Ablegen im Raster | Spieler | 2 | 3 | offen |
| [[REQ-327]] | Packen am Telefon | Spieler | 2 | 2 | offen |
| [[REQ-328]] | Ablage für nicht Verstautes | Spieler | 2 | 1 | offen |
| [[REQ-333]] | Vorgaben für Formen und Stapel | Spielleitung | 2 | 2 | offen |
| [[REQ-355]] | Tragraster, Zonen und Behälter einstellen | Spielleitung | 2 | 3 | steht |
| [[REQ-356]] | Tragblatt aus Bausteinen mit Zonen und Bedingungen | Spielleitung | 2 | 5 | steht |
| [[REQ-183]] | Gruppeninventar | Spieler | 3 | 2 | steht |
| [[REQ-215]] | Tragraster aus Grösse und Stärke | Spieler | 3 | 2 | teils |
| [[REQ-216]] | Behälter in Behältern | Spieler | 3 | 2 | teils |
| [[REQ-217]] | Ziehen am Bogen | Spieler | 3 | 2 | steht |
| [[REQ-225]] | Fallenlassen und Verstauen | Spieler | 3 | 1 | teils |
| [[REQ-065]] | Inventar als Raster | Spieler | 4 | 8 | steht |
| [[REQ-214]] | Ausrüstungsfigur | Spieler | 4 | 2 | steht |
| [[REQ-276]] | Unverstaute Gegenstände gelten als liegengelassen | Spielleitung | 4 | 2 | offen |
| [[REQ-277]] | Gegenstände mit Form spiegeln | Spieler | 4 | 1 | offen |

### F-027 Eigene Inhalte der Spielenden

Notizen, Ziele, Lore-Artikel, die Spielende selbst anlegen. — [[F-027 Eigene Inhalte der Spielenden]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-072]] | Eigene Notizen | Spieler | 2 | 2 | offen |
| [[REQ-083]] | Eigene Quests und Ziele | Spieler | 3 | 1 | offen |
| [[REQ-109]] | Lore-Texte von Spielenden | Spieler | 3 | 3 | teils |

### F-028 Chat

Fäden zwischen Leitung und Spielenden, daraus Kampagneninhalt. — [[F-028 Chat]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-202]] | Chats bleiben privat | Spieler | 2 | 2 | offen |
| [[REQ-200]] | Chat mit der Leitung und unter Spielenden | Spieler | 3 | 5 | offen |
| [[REQ-201]] | Aus dem Chat wird Inhalt | Spielleitung | 3 | 3 | offen |

### F-078 Beute

Beute vorbereiten, während der Sitzung öffnen und von Spielenden nehmen lassen. — [[F-078 Beute]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-332]] | Beute öffnen und nehmen | Spieler | 3 | 3 | offen |

### F-079 Tragplätze

Körperplan des Inventarmoduls, tragende Ausrüstung als Behälter mit eigenem kleinem Raster (Gürtel, Riemen, Scheide, Köcher, Laschen), Verbund-Zonen für Stücke über mehrere Zellen, Trageregeln am Gegenstand, alle möglichen Plätze mit Grund und Verdrängen. — [[F-079 Tragplätze]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-334]] | Tragende Ausrüstung als Behälter mit eigenem Raster | Spielleitung | 2 | 3 | offen |
| [[REQ-335]] | Verbund: Zellen, die gemeinsam ein Stück tragen | Spielleitung | 2 | 2 | offen |
| [[REQ-336]] | Festlegen, wo ein Gegenstand getragen werden darf | Spielleitung | 2 | 2 | offen |
| [[REQ-337]] | Sehen, was weichen muss | Spieler | 2 | 2 | offen |
| [[REQ-338]] | Körperplätze als Plan des Moduls | Spielleitung | 2 | 3 | offen |
| [[REQ-339]] | Tragende Ausrüstung an der Figur | Spieler | 2 | 3 | offen |
| [[REQ-340]] | Raster und Zonen eines Trägers in der Maske | Spielleitung | 3 | 3 | offen |

## EP-05 Kampagne & Sitzungen

31 Stories · 106 Punkte · 17 steht · 3 teils · 11 offen — [[EP-05 Kampagne & Sitzungen]]

### F-029 Kampagne

Die Kampagne als Wurzel: Einstellungen, Kampagnenwerte, Anlegen mit Dialog, Bereiche als Seiten. — [[F-029 Kampagne]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-075]] | Die Kampagne als Wurzel | Spielleitung | 1 | 3 | steht |
| [[REQ-278]] | Bereiche als eigene Seiten | Spielleitung | 1 | 2 | steht |
| [[REQ-043]] | Einstellungen der Kampagne | Spielleitung | 2 | 2 | steht |
| [[REQ-236]] | Kampagne mit Dialog anlegen | Spielleitung | 2 | 3 | offen |
| [[REQ-279]] | Kampagnenwerte pflegen und in Texten nutzen | Spielleitung | 2 | 2 | teils |

### F-030 Bereich Story

Arcs, Kapitel, Quests, Szenen, Fäden — die Geschichte der Kampagne. — [[F-030 Bereich Story]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-076]] | Geschichte gliedern | Spielleitung | 1 | 3 | steht |
| [[REQ-080]] | Vorlesetexte nach der Sitzung freigeben | Spielleitung | 3 | 2 | offen |
| [[REQ-082]] | Quests mit Aufgaben und Lohn | Spielleitung | 3 | 3 | steht |
| [[REQ-180]] | Gepflanzte Fäden | Spielleitung | 3 | 3 | offen |

### F-031 Sitzungen & Vorbereitung

Sitzungen, Vorbereitungsseite, Unfertiges und Todos, Schnellerfassung, Sitzungsansicht. — [[F-031 Sitzungen & Vorbereitung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-077]] | Sitzungen mit Geplantem und Geschehenem | Spielleitung | 2 | 3 | steht |
| [[REQ-078]] | Vorbereitungsseite | Spielleitung | 2 | 5 | steht |
| [[REQ-079]] | Schnelle Aktionen in der Sitzung | Spielleitung | 2 | 3 | teils |
| [[REQ-282]] | Sitzungsansicht für das Spiel | Spielleitung | 2 | 3 | offen |
| [[REQ-084]] | Ideen und Unfertiges | Spielleitung | 3 | 3 | steht |
| [[REQ-188]] | Übersicht über alles Unfertige | Spielleitung | 3 | 2 | steht |
| [[REQ-189]] | Gesammelte Todos | Spielleitung | 3 | 2 | steht |
| [[REQ-190]] | Schnellerfassung im Spiel | Spielleitung | 3 | 2 | steht |
| [[REQ-280]] | Umschalter Vorbereitung und Spiel | Spielleitung | 4 | 2 | offen |

### F-032 Begegnungen

Begegnungen bauen und vorbereiten, Begegnungstabellen, Weltzustand zwischen Sitzungen. — [[F-032 Begegnungen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-085]] | Begegnungen | Spielleitung | 2 | 3 | steht |
| [[REQ-172]] | Begegnungstabellen je Gebiet | Spielleitung | 3 | 3 | steht |
| [[REQ-221]] | Begegnungen bauen | Spielleitung | 3 | 3 | offen |
| [[REQ-173]] | Weltzustand zwischen Sitzungen | Spielleitung | 4 | 3 | offen |

### F-033 Abenteuer übernehmen

Vorgefertigte Abenteuer als Ebene, Kapitel und Szenen in die eigene Geschichte holen. — [[F-033 Abenteuer übernehmen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-240]] | Abenteuer als eigene Ebene | Spielleitung | 2 | 13 | steht |
| [[REQ-252]] | Abenteuer modular übernehmen | Spielleitung | 2 | 5 | steht |

### F-034 Party

Die Figurengruppe einer Kampagne mit ihrer Übersicht. — [[F-034 Party]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-281]] | Eine Party je Kampagne | Spielleitung | 1 | 2 | steht |
| [[REQ-086]] | Gruppenübersicht | Spielleitung | 3 | 3 | teils |
| [[REQ-122]] | Gruppe als Widget | Spielleitung | 3 | 2 | steht |

### F-035 Ladebildschirm-Board

Ein öffentliches Board je Kampagne mit Widgets, das alle anpassen. — [[F-035 Ladebildschirm-Board]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-283]] | Kampagnen-Ladebildschirm | Spieler | 3 | 3 | offen |

### F-036 Sitzungsmitschnitt

Audio aufnehmen, transkribieren, Recap-Entwurf. — [[F-036 Sitzungsmitschnitt]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-196]] | Sitzung aufnehmen | Spielleitung | 4 | 5 | offen |
| [[REQ-197]] | Transkript und Recap-Entwurf | Spielleitung | 4 | 8 | offen |
| [[REQ-198]] | Sprecher im Transkript | Spielleitung | 5 | 5 | offen |

## EP-06 Welt & Lore

17 Stories · 63 Punkte · 8 steht · 1 teils · 6 offen · 2 ersetzt — [[EP-06 Welt & Lore]]

### F-037 Bereich World

Orte, Fraktionen, Gottheiten, Lore-Artikel, Welt als Ebene, Kampagnenabweichungen. — [[F-037 Bereich World]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-101]] | Lore-Artikel | Spielleitung | 2 | 3 | steht |
| [[REQ-103]] | Orte mit Hierarchie | Spielleitung | 2 | 2 | steht |
| [[REQ-104]] | Fraktionen | Spielleitung | 2 | 2 | steht |
| [[REQ-107]] | Gottheiten und Pantheons | Spielleitung | 4 | 1 | offen |
| [[REQ-110]] | Illustrierte Bibliothek | Spieler | 5 | 8 | offen |

### F-038 Kalender & Zeitleisten

Weltdatum, Kalender an der Welt, Zeitleisten der Weltgeschichte und der Kampagne. — [[F-038 Kalender & Zeitleisten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-024]] | Weltdatum | Spielleitung | 1 | 2 | steht |
| [[REQ-025]] | Kalender der Welt | Spielleitung | 3 | 5 | offen |
| [[REQ-106]] | Ereignisse und Zeitleisten | Spielleitung | 3 | 3 | steht |
| [[REQ-220]] | Zeitleisten der Weltgeschichte | Spielleitung | 3 | 3 | steht |
| [[REQ-087]] | Kalendermodul | Spielleitung | 5 | 13 | offen |

### F-039 Beziehungen & Ruf

Beziehungen als Kanten mit Marken. — [[F-039 Beziehungen & Ruf]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-030]] | Ruf als gewichtete Marken | – | 2 | 1 | ersetzt |
| [[REQ-061]] | Beziehungen zwischen Figuren | Spielleitung | 2 | 2 | steht |
| [[REQ-081]] | Ruf, der sich ausbreitet | – | 4 | 8 | ersetzt |

### F-040 Läden & Wirtschaft

Läden mit Waren und Preisen, Fraktionspreise, andere Währungen. — [[F-040 Läden & Wirtschaft]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-284]] | Läden mit Waren und Preisen | Spielleitung | 2 | 3 | steht |
| [[REQ-285]] | Fraktionspreise | Spielleitung | 3 | 2 | teils |
| [[REQ-185]] | Andere Währungen und Tausch | Spielleitung | 5 | 2 | offen |

### F-041 Namensgenerator

Namen für Figuren und Orte erzeugen. — [[F-041 Namensgenerator]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-254]] | Namensgenerator | Spielleitung | 4 | 3 | offen |

## EP-07 Regeln & Nachschlagen

28 Stories · 131 Punkte · 13 steht · 2 teils · 13 offen — [[EP-07 Regeln & Nachschlagen]]

### F-042 Bereich Rules & Kompendium

Regelartikel, Nachschlagen in Sekunden, Merkzettel, Zustände. — [[F-042 Bereich Rules & Kompendium]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-089]] | Regeln als Artikel | Spielleitung | 1 | 2 | steht |
| [[REQ-091]] | Regeln durchsuchen | Spieler | 2 | 5 | steht |
| [[REQ-094]] | Regeln an Artikel hängen | Spielleitung | 2 | 3 | steht |
| [[REQ-098]] | Regel in Sekunden | Spieler | 2 | 2 | steht |
| [[REQ-313]] | Zustände als Artikel | Spielleitung | 2 | 3 | teils |
| [[REQ-099]] | Regeln anheften | Spieler | 3 | 1 | steht |

### F-043 Bücher & Leseansicht

Eine Ebene als Buch lesen, Kapitel aus Teilen. — [[F-043 Bücher & Leseansicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-247]] | Bücher lesen | Spieler | 2 | 8 | steht |

### F-044 Klassen

Klassenansicht mit Stufentabelle und Unterklassen. — [[F-044 Klassen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-231]] | Klassen wie im Buch | Spieler | 3 | 3 | steht |

### F-045 Zauber

Zauber als Artikel, Zauberlisten. — [[F-045 Zauber]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-092]] | Zauber als Artikel | Spieler | 2 | 3 | offen |
| [[REQ-097]] | Zauberlisten | Spieler | 3 | 2 | steht |

### F-046 Regelauswertung

Effekte, Bedingungen und Wechselwirkungen von Regeln auswerten. — [[F-046 Regelauswertung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-018]] | Wirkungen von Regeln beschreiben | Spielleitung | 1 | 2 | offen |
| [[REQ-357]] | Regelgraphen wirken am Tisch | Spielleitung | 3 | 13 | teils |
| [[REQ-017]] | Begriffe je Regelsystem auswerten | Spielleitung | 4 | 5 | offen |
| [[REQ-095]] | Gewährtes anwenden | Spieler | 4 | 8 | offen |
| [[REQ-290]] | Wechselwirkungen von Regeln auswerten | Spielleitung | 4 | 8 | offen |
| [[REQ-093]] | Regeln auswerten | Spielleitung | 5 | 13 | offen |
| [[REQ-096]] | Einschränkungen prüfen | Spielleitung | 5 | 8 | offen |

### F-047 Handwerk

Rezepte, Material, Fortschritt, Blaupausen lernen. — [[F-047 Handwerk]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-349]] | Wie Blaupausen gelernt werden, ist eine Regeloption | Spielleitung | 1 | 2 | steht |
| [[REQ-347]] | Handwerk an der Figur | Spieler | 2 | 3 | steht |
| [[REQ-218]] | Blaupausen lernen | Spieler | 3 | 2 | steht |
| [[REQ-219]] | Material beim Start binden | Spieler | 3 | 2 | steht |
| [[REQ-184]] | Handwerk mit Rezepten | Spieler | 4 | 5 | steht |

### F-048 Regelsysteme & Module

Regelsysteme und Module als Ebenen, je Sorte ein Modul, gewählt an der Kampagne; Homebrew-Regeln; Rahmen wie Taverne. — [[F-048 Regelsysteme & Module]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-287]] | Regelsysteme und Module als Ebenen | Spielleitung | 2 | 8 | offen |
| [[REQ-319]] | Inventarregeln als wählbares Modul | Spielleitung | 2 | 5 | offen |
| [[REQ-289]] | Homebrew-Regeln erfassen | Spielleitung | 3 | 3 | offen |
| [[REQ-223]] | Rahmen für Regelsysteme wie Taverne | Spielleitung | 4 | 5 | offen |

### F-049 Masse & Einheiten

Masse beim Lesen umrechnen, auch im Fliesstext. — [[F-049 Masse & Einheiten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-377]] | Massstäbe und Einheiten der Karte | Spielleitung | 2 | 5 | offen |
| [[REQ-227]] | Masse im Fliesstext umrechnen | Spieler | 3 | 2 | offen |

## EP-08 Live-Spiel

31 Stories · 119 Punkte · 14 steht · 6 teils · 10 offen · 1 ersetzt — [[EP-08 Live-Spiel]]

### F-050 Spielleiter-Schirm

Bereich Play: der Schirm mit seinen Boards über mehrere Fenster, Tischanzeige. — [[F-050 Spielleiter-Schirm]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-187]] | Tischanzeige | Spielleitung | 3 | 2 | offen |
| [[REQ-204]] | Spielleiter-Schirm | Spielleitung | 3 | 5 | offen |
| [[REQ-205]] | Ein Board je Geschichtsartikel | Spielleitung | 3 | 3 | teils |

### F-051 Initiative

Initiative für Leitung und Spielende, Zustände mit Dauer, Anzeige auf der Karte. — [[F-051 Initiative]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-115]] | Initiative | Spielleitung | 2 | 5 | steht |
| [[REQ-211]] | Initiative wie Improved Initiative | Spielleitung | 2 | 3 | steht |
| [[REQ-212]] | Zustände und Notizen mit Dauer | Spielleitung | 2 | 2 | steht |
| [[REQ-128]] | Kampf aus Sicht der Spielenden | Spieler | 3 | 3 | teils |
| [[REQ-213]] | Initiative der Spielenden | Spieler | 3 | 2 | steht |
| [[REQ-226]] | Gegner erscheinen in Runde 1 erst in ihrem Zug | Spieler | 3 | 1 | steht |
| [[REQ-144]] | Initiative auf der Karte | Spieler | 4 | 2 | steht |

### F-052 Sitzungszustand & Live-Kanal

Was gerade läuft, steht an der Sitzung und kommt live zu allen; Protokoll und Statistik. — [[F-052 Sitzungszustand & Live-Kanal]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-362]] | Spielboard: was gerade läuft | Spieler | 1 | 8 | offen |
| [[REQ-363]] | Den Spielenden etwas zeigen | Spielleitung | 1 | 5 | offen |
| [[REQ-116]] | Was gerade läuft, steht an der Sitzung | Spielleitung | 2 | 8 | steht |
| [[REQ-117]] | Wer am Sitzungszustand schreibt | Spielleitung | 3 | 3 | steht |
| [[REQ-120]] | Spielprotokoll | Spielleitung | 3 | 3 | teils |
| [[REQ-121]] | Statistik | Spieler | 4 | 3 | offen |

### F-053 Würfel

Würfeln für sich und für alle, mit Protokoll. — [[F-053 Würfel]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-070]] | Würfeln | Spieler | 2 | 2 | steht |
| [[REQ-071]] | Würfe für alle | Spieler | 4 | 3 | steht |

### F-054 Werkzeuge am Tisch

Widgets: Notizen, Schnellanlage, Begegnung, Timer, Tabellen, Musik, Fragen. — [[F-054 Werkzeuge am Tisch]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-112]] | Widget mit mehreren offenen Artikeln | – | 2 | 3 | ersetzt |
| [[REQ-113]] | Notiz-Widget | Spielleitung | 2 | 2 | offen |
| [[REQ-114]] | Schnellanlage auf dem Schirm | Spielleitung | 2 | 3 | teils |
| [[REQ-292]] | Neuen Artikel aus einer Auswahl anlegen | Spielleitung | 2 | 2 | teils |
| [[REQ-373]] | Werkzeugleiste mit Belegungen, Hilfe und Kürzeln | Spielleitung | 2 | 8 | offen |
| [[REQ-118]] | Begegnung starten | Spielleitung | 3 | 5 | steht |
| [[REQ-123]] | Timer | Spielleitung | 3 | 1 | offen |
| [[REQ-124]] | Auftragsbrett als Widget | Spieler | 3 | 2 | steht |
| [[REQ-125]] | Zufallstabellen | Spielleitung | 3 | 5 | steht |
| [[REQ-186]] | Verschachtelte Tabellen | Spielleitung | 3 | 2 | steht |
| [[REQ-126]] | Musik einbinden | Spielleitung | 4 | 2 | teils |
| [[REQ-127]] | Eigene Klangtafel | Spielleitung | 5 | 13 | offen |
| [[REQ-129]] | Fragen an einen Assistenten | Spielleitung | 5 | 8 | offen |

## EP-09 Karten

32 Stories · 150 Punkte · 18 steht · 6 teils · 8 offen — [[EP-09 Karten]]

### F-055 Karte & Kartenebenen

Karte mit Bild, Gitter, Massstab; Unterkarten zum Hineinzoomen. — [[F-055 Karte & Kartenebenen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-372]] | Spielende sehen nur Karten im Spiel | Spielleitung | 1 | 5 | offen |
| [[REQ-130]] | Karte mit Gitter und Massstab | Spielleitung | 3 | 2 | steht |
| [[REQ-131]] | Unterkarten zum Hineinzoomen | Spielleitung | 3 | 8 | steht |
| [[REQ-132]] | Kartenebene festhalten | Spielleitung | 3 | 1 | offen |
| [[REQ-293]] | Ladeanzeige für Kartenbilder | Spielleitung | 3 | 1 | steht |
| [[REQ-375]] | Kartenstufen ineinander übergehen lassen | Spielleitung | 3 | 8 | offen |
| [[REQ-138]] | Grosse Karten in Kacheln | Spieler | 4 | 5 | steht |

### F-056 Tokens & Marker

Marker, Kulisse, Spiel-Tokens, Gruppen-Token, Grösse. — [[F-056 Tokens & Marker]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-133]] | Marker, die zu Artikeln führen | Spielleitung | 3 | 3 | steht |
| [[REQ-135]] | Tokens im Spiel | Spielleitung | 3 | 5 | teils |
| [[REQ-136]] | Gruppe und Quests auf der Karte | Spieler | 3 | 2 | steht |
| [[REQ-224]] | Kreaturen nach Grösse auf der Karte | Spielleitung | 3 | 3 | steht |
| [[REQ-294]] | Token ohne Bild zeigt den Anfangsbuchstaben | Spielleitung | 3 | 1 | teils |
| [[REQ-374]] | Tokens zwischen Kartenstufen | Spielleitung | 3 | 5 | offen |
| [[REQ-134]] | Kulisse auf der Karte | Spielleitung | 4 | 3 | steht |

### F-057 Nebel, Licht & Sicht

Aufdecken, Licht und Sichtlinien. — [[F-057 Nebel, Licht & Sicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-209]] | Aufdecken von Hand oder entlang des Pfads | Spielleitung | 3 | 3 | steht |
| [[REQ-139]] | Nebel | Spielleitung | 4 | 8 | steht |
| [[REQ-140]] | Licht und Sicht mit Wänden | Spielleitung | 5 | 13 | steht |

### F-058 Bewegung & Zonen

Bewegungsrechner, Pfad, Zonen, Vollbild und eigene Tokens bewegen. — [[F-058 Bewegung & Zonen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-312]] | Eigenes Token bewegen | Spieler | 2 | 3 | teils |
| [[REQ-206]] | Bewegungsrechner | Spielleitung | 3 | 3 | steht |
| [[REQ-207]] | Pfad mit Wegpunkten | Spieler | 3 | 2 | steht |
| [[REQ-208]] | Zonen mit eigenen Regeln | Spielleitung | 3 | 5 | teils |
| [[REQ-210]] | Karte und Initiative im Vollbild | Spielleitung | 3 | 3 | teils |

### F-059 Gebiete & Overlays

Gebiete und Hervorhebungen auf der Karte. — [[F-059 Gebiete & Overlays]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-376]] | Kartenbereiche | Spielleitung | 2 | 8 | offen |
| [[REQ-137]] | Hervorhebungen nach Abfrage | Spielleitung | 4 | 5 | teils |
| [[REQ-193]] | Gebiete auf der Karte | Spielleitung | 4 | 3 | steht |

### F-060 Reisen & Erkundung

Point-Crawl, Erkundungsstand, Vorräte und Aktionen je Knoten. — [[F-060 Reisen & Erkundung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-168]] | Point-Crawl | Spielleitung | 3 | 5 | steht |
| [[REQ-169]] | Erkundungsstand | Spieler | 3 | 3 | steht |
| [[REQ-170]] | Vorräte auf Reisen | Spielleitung | 4 | 2 | steht |
| [[REQ-171]] | Aktionen je Knoten | Spieler | 4 | 3 | steht |

### F-061 Karteneditor

Zeichnen, Assets platzieren, Effekte. — [[F-061 Karteneditor]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-141]] | Effekte auf der Karte | Spielleitung | 5 | 8 | offen |
| [[REQ-142]] | Auf Karten zeichnen | Spielleitung | 5 | 8 | offen |
| [[REQ-143]] | Karteneditor | Spielleitung | 5 | 13 | offen |

## EP-10 Medien & Assets

22 Stories · 83 Punkte · 4 steht · 3 teils · 15 offen — [[EP-10 Medien & Assets]]

### F-062 Asset-Ablage

Wo Bilder und Dateien liegen und wie sie gefunden werden. — [[F-062 Asset-Ablage]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-020]] | Quelle eines Artikels | Spielleitung | 1 | 2 | steht |
| [[REQ-021]] | Dateien als Assets | Spielleitung | 1 | 3 | steht |
| [[REQ-145]] | Ablage in der Seite | Spielleitung | 1 | 3 | teils |
| [[REQ-146]] | Grosse Dateien auf dem NAS | Verwaltung | 2 | 5 | offen |
| [[REQ-022]] | Vorschaubilder und Kacheln | Spieler | 3 | 5 | offen |
| [[REQ-148]] | Bilder von aussen | Spielleitung | 3 | 1 | steht |
| [[REQ-370]] | Assets ohne Vorbereitungsstand | Spielleitung | 3 | 2 | offen |
| [[REQ-150]] | Audio ablegen | Spielleitung | 5 | 2 | offen |
| [[REQ-151]] | 3D-Dateien | Spielleitung | 5 | 8 | offen |

### F-063 Bildverwaltung

Hochladen, Übersicht, Bildklassen, Ersetzen, Import der Bilder. — [[F-063 Bildverwaltung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-147]] | Bilder hochladen | Spielleitung | 2 | 2 | teils |
| [[REQ-295]] | Bild ersetzen als Fassung oder neue Quelle | Spielleitung | 3 | 2 | offen |
| [[REQ-296]] | Bildklassen | Spielleitung | 3 | 2 | teils |
| [[REQ-297]] | Bilder aus 5e.tools einlesen und verknüpfen | Spielleitung | 3 | 5 | offen |
| [[REQ-329]] | Bilder im Inventar | Spieler | 3 | 2 | offen |

### F-064 Token-Werkstatt

Bilder bearbeiten, Tokens zusammenstellen. — [[F-064 Token-Werkstatt]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-330]] | Inventory image an einen Gegenstand binden | Spielleitung | 3 | 2 | offen |
| [[REQ-298]] | Bilder bearbeiten und Tokens zusammenstellen | Spielleitung | 4 | 8 | offen |
| [[REQ-331]] | Hilfe für Gegenstandsbilder | Spielleitung | 4 | 1 | offen |

### F-065 Druck & Ausfuhr

Ein Artikel auf einem Blatt, Karten und Bögen drucken, Ausfuhr nach Markdown. — [[F-065 Druck & Ausfuhr]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-029]] | Ausfuhr und Einfuhr | Verwaltung | 3 | 3 | steht |
| [[REQ-167]] | Drucken | Spielleitung | 3 | 5 | offen |
| [[REQ-195]] | Statblock nach Obsidian ausführen | Spielleitung | 4 | 2 | offen |

### F-066 PDF & OCR

PDF anzeigen, Seiten anspringen, Texte erkennen. — [[F-066 PDF & OCR]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-149]] | PDF mit Seitensprung | Spieler | 4 | 5 | offen |
| [[REQ-152]] | Texte aus PDF erkennen | Spielleitung | 5 | 13 | offen |

## EP-11 Oberfläche & Navigation

31 Stories · 109 Punkte · 20 steht · 6 teils · 4 offen · 1 ersetzt — [[EP-11 Oberfläche & Navigation]]

### F-067 Boards

Leinwände mit Platzierungen, Ankern und Bereichen; Anlegen auf dem Board. — [[F-067 Boards]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-111]] | Boards | Spielleitung | 2 | 8 | steht |
| [[REQ-157]] | Frei anordnen auf dem Board | Spielleitung | 2 | 8 | steht |
| [[REQ-158]] | Ansicht je Platzierung | Spielleitung | 2 | 3 | steht |
| [[REQ-161]] | Regeln für die Darstellung | Spielleitung | 2 | 5 | steht |
| [[REQ-165]] | Bilder, Formen und Werkzeuge auf dem Board | Spielleitung | 2 | 3 | steht |
| [[REQ-166]] | Auf dem Board anlegen | Spielleitung | 2 | 2 | teils |
| [[REQ-358]] | Kampagnenboard als Startpunkt für Spielende | Spieler | 2 | 8 | steht |
| [[REQ-360]] | Struktur einer Fraktion als Organigramm oder Netz | Spielleitung | 2 | 8 | steht |
| [[REQ-119]] | Boards der Spielenden | Spieler | 3 | 3 | offen |
| [[REQ-159]] | Anker und Bereiche auf dem Board | Spielleitung | 3 | 3 | steht |
| [[REQ-160]] | Zwischen Ankern springen | Spielleitung | 3 | 2 | teils |
| [[REQ-291]] | Leseansicht auf dem Board | Spielleitung | 3 | 3 | offen |
| [[REQ-162]] | Semantischer Zoom | Spielleitung | 4 | 5 | offen |

### F-068 Suche

Übergreifende Suche beim Tippen, Volltext. — [[F-068 Suche]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-304]] | Übergreifende Suche beim Tippen | Spieler | 1 | 3 | steht |
| [[REQ-028]] | Volltextsuche | Spieler | 3 | 3 | teils |

### F-069 Filter & Filtergruppen

Filter einer Seite, gespeicherte Filtergruppen. — [[F-069 Filter & Filtergruppen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-303]] | Filtergruppen je Seite | Spielleitung | 2 | 3 | steht |
| [[REQ-318]] | Ein Ebenenfilter, global und speicherbar | Spielleitung | 2 | 3 | steht |
| [[REQ-302]] | Der Filter gehört der Seite | Spielleitung | 3 | 1 | steht |

### F-070 Navigation & Kurzansicht

Kopfleiste, Brotkrumen, Kurzansicht als Popup, Kampagne und Ebene sichtbar. — [[F-070 Navigation & Kurzansicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-315]] | Globale Kopfleiste | Spieler | 1 | 2 | steht |
| [[REQ-317]] | Zurück an dieselbe Stelle | Spielleitung | 1 | 2 | steht |
| [[REQ-342]] | Handbuch: alle Erklärungen an einer Stelle | Spielleitung | 1 | 5 | steht |
| [[REQ-361]] | Lange Seiten: Bereiche klappen und springen | Spielleitung | 1 | 3 | teils |
| [[REQ-248]] | Kurzansicht überall | Spieler | 2 | 5 | steht |
| [[REQ-305]] | Kampagne und Ebene immer sichtbar | Spielleitung | 2 | 2 | steht |
| [[REQ-345]] | Schwebende Werkzeugleiste für eine Auswahl | Spieler | 2 | 3 | teils |

### F-071 Bearbeiten in der Ansicht

Felder dort bearbeiten, wo sie stehen; optionale Felder; Löschen mit Rückfrage. — [[F-071 Bearbeiten in der Ansicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-299]] | Optionale Felder verdeckt | Spielleitung | 3 | 2 | steht |
| [[REQ-307]] | Löschen mit Rückfrage in der Seite | Spielleitung | 3 | 1 | steht |

### F-072 Design & Stilkonzept

Pergament wie die Bücher, Lesbarkeit, Stilkonzept, Sprache der Oberfläche. — [[F-072 Design & Stilkonzept]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-153]] | Deutsche Oberfläche | – | 2 | 2 | ersetzt |
| [[REQ-300]] | Gestaltung wie die Bücher | Spielleitung | 3 | 3 | teils |
| [[REQ-306]] | Lesbarkeit im Feinschliff | Spieler | 3 | 2 | steht |
| [[REQ-301]] | Stilkonzept in der Verwaltung anpassen | Verwaltung | 4 | 3 | offen |

## EP-12 Import & Inhalte

10 Stories · 39 Punkte · 5 steht · 2 teils · 1 offen · 2 verworfen — [[EP-12 Import & Inhalte]]

### F-073 5e.tools-Import

Einmal einlesen, danach ergänzen; jede Quelle in ihre Ebene. — [[F-073 5e.tools-Import]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-047]] | Import von 5e.tools, Improved Initiative und Obsidian als Einstieg | – | 2 | 5 | verworfen |
| [[REQ-090]] | Regeln aus Obsidian und 5e.tools einlesen | – | 2 | 3 | verworfen |
| [[REQ-239]] | Jedes Buch eine Ebene | Spielleitung | 2 | 3 | steht |
| [[REQ-243]] | Alle Inhalte als abschaltbare Ebenen | Spielleitung | 2 | 8 | steht |
| [[REQ-233]] | 5e.tools über eine Pipeline laden | Verwaltung | 3 | 3 | steht |

### F-074 Regelwerke anderer Verlage

Pakete wie Kibbles’ Compendium über die API laden. — [[F-074 Regelwerke anderer Verlage]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-314]] | Regelwerk eines Drittverlags laden | Spielleitung | 3 | 5 | teils |

### F-075 Obsidian-Vault

Notizen aus dem Vault einlesen. — [[F-075 Obsidian-Vault]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-308]] | Obsidian-Vault einlesen | Spielleitung | 3 | 5 | offen |

### F-076 Artikelprüfung & Nachtarbeit

Artikel nachts auf Vollständigkeit prüfen und ergänzen, mit Protokoll. — [[F-076 Artikelprüfung & Nachtarbeit]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-286]] | Artikel nachts auf Vollständigkeit prüfen | Spielleitung | 3 | 3 | steht |
| [[REQ-309]] | Claude darf auf dev ergänzen, mit Protokoll | Spielleitung | 3 | 1 | steht |

### F-077 KI-Inhalte

Von Claude erzeugte Inhalte in eigener Ebene, z. B. Preise. — [[F-077 KI-Inhalte]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-288]] | Preise für jeden Gegenstand | Spielleitung | 3 | 3 | teils |

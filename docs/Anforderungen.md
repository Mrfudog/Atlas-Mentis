# Anforderungen — was gefordert war und was steht

Stand 2026-10-14. Jede Story aus dem Vault (`VTT/Stories/`, gegliedert in Epics und Features), mit dem Stand im Repo.
Erzeugt von `packages/registry/scripts/anforderungen.mjs`; der Stand ist ein Urteil und steht in der Story-Notiz
(`stand`, `standNotiz`) — wer ihn anders sieht, ändert die Notiz und lässt das Skript laufen.

| Stand | Heisst |
|---|---|
| **steht** | gebaut, in der Form der Anforderung oder einer gleichwertigen |
| **teils** | ein Teil steht; was fehlt, steht in der Anmerkung |
| **offen** | nichts davon steht |
| **ersetzt** | anders gelöst als gefordert, mit Absicht — die Anmerkung sagt wie |
| **verworfen** | entschieden gegen die Anforderung |

Zusammen: 166 steht · 48 teils · 85 offen · 10 ersetzt · 6 verworfen — 315 Stories in 77 Features und 12 Epics.

| Epic | Stories | Stand |
|---|---|---|
| [EP-01 Inhaltsgerüst](#ep-01-inhaltsgerüst) | 51 | 31 steht · 10 teils · 4 offen · 4 ersetzt · 2 verworfen |
| [EP-02 Zugang & Betrieb](#ep-02-zugang--betrieb) | 37 | 22 steht · 5 teils · 7 offen · 1 ersetzt · 2 verworfen |
| [EP-03 Kreaturen & Figuren](#ep-03-kreaturen--figuren) | 27 | 16 steht · 1 teils · 9 offen · 1 ersetzt |
| [EP-04 Spielererlebnis](#ep-04-spielererlebnis) | 21 | 8 steht · 5 teils · 8 offen |
| [EP-05 Kampagne & Sitzungen](#ep-05-kampagne--sitzungen) | 31 | 17 steht · 3 teils · 11 offen |
| [EP-06 Welt & Lore](#ep-06-welt--lore) | 17 | 8 steht · 1 teils · 6 offen · 2 ersetzt |
| [EP-07 Regeln & Nachschlagen](#ep-07-regeln--nachschlagen) | 23 | 10 steht · 1 teils · 12 offen |
| [EP-08 Live-Spiel](#ep-08-live-spiel) | 28 | 14 steht · 6 teils · 7 offen · 1 ersetzt |
| [EP-09 Karten](#ep-09-karten) | 28 | 18 steht · 6 teils · 4 offen |
| [EP-10 Medien & Assets](#ep-10-medien--assets) | 18 | 4 steht · 3 teils · 11 offen |
| [EP-11 Oberfläche & Navigation](#ep-11-oberfläche--navigation) | 24 | 13 steht · 5 teils · 5 offen · 1 ersetzt |
| [EP-12 Import & Inhalte](#ep-12-import--inhalte) | 10 | 5 steht · 2 teils · 1 offen · 2 verworfen |

## EP-01 Inhaltsgerüst

Register, Arten, Felder, Kanten, Ebenen und Fassungen, Ansichten — das Modell, mit dem jeder Artikel beschrieben, gespeichert und gezeichnet wird.

### F-001 Artikelmodell

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-001 | Artikel aus Arten, Feldern und Kanten | 1 | **steht** | Peg, Karten, Kanten, Register — Datenmodell.md §1–5 |
| REQ-002 | Nachfolgerkette | 1 | **ersetzt** | keine Nachfolgerkette; Fassungen über `overrides` und `variantOf` in Ebenen |
| REQ-010 | Feldgruppen nur, wo sie gebraucht werden | 1 | **steht** | als Grundtypen: `Visibility`, `Status`, `Time` |
| REQ-011 | Inhaltsblock als eigenes Grundelement | 1 | **ersetzt** | ein Textblock ist ein Feld (`many` + `long`) mit Eintrags-Id; gesperrt wird je Eintrag über eine Information |
| REQ-016 | Übersetzungsschicht für Begriffe | 1 | **verworfen** | keine Übersetzungsschicht; Bezeichner englisch, Inhalte in der Sprache der Kampagne |
| REQ-019 | Rohform jedes Imports aufbewahren | 1 | **verworfen** | die Importer sind weg (2026-09-20), mit ihnen `Imported`; kommt mit neuen Importern zurück |
| REQ-163 | Bezeichner ohne Bedeutung | 1 | **steht** | undurchsichtige Id; `Identity.id` als Nummer |
| REQ-181 | Freie Felder an einem einzelnen Artikel | 2 | **steht** | `adhoc` mit Befördern |
| REQ-182 | Kanten lesen sich von beiden Enden | 2 | **steht** | `inverseLabel` |

### F-002 Register

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-027 | Arten ohne Code anlegen | 4 | **steht** | das Register ist Daten mit Masken (Prototyp, Registerseite in der Web-Oberfläche: REQ-230); keine Codeänderung je Art |
| REQ-230 | Register in der Seite bearbeiten | 2 | **steht** | Registerseite `/registry` mit Zählung (`registryUsage`, `GET /api/registry/usage`); schreiben Verwaltung und `gm` der laufenden Kampagne (W5, D64) |
| REQ-260 | Ausgehende Kanten im Register sehen | 3 | **steht** | Gruppe „Edges from here“ im Register |
| REQ-262 | Flache Typenlisten | 3 | **steht** | `typeList()` |
| REQ-263 | Was eine Einstellung im Register auslöst | 3 | **steht** | Erklärzeilen im Register |
| REQ-265 | Register zeigt einen Typ auf einer Fläche | 2 | **steht** | Registerfläche, `UI.regOpen` |

### F-003 Feldformen & Aufzählungen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-012 | Textfelder für jede Art von Text | 2 | **steht** | als Prosafelder: paragraph, readaloud, fact, secret, lore, tactics, note, poem, song, appearance, personality |
| REQ-023 | Status idea/planned/used/discarded | 2 | **ersetzt** | `State`: idea · prepared · ready; used/discarded waren Ereignisse und sind das Feld der Art (`Quest.progress`, `Encounter.phase`) |
| REQ-258 | Verweisfeld nennt, welche Artikel es annimmt | 2 | **teils** | `PropertySchema.target`, `link_wrong_type`; Vorschläge in den Sichtbarkeitsfeldern für jede Art noch nicht überall |
| REQ-259 | Vorgabewerte für Felder | 3 | **steht** | `default` am Feld |
| REQ-261 | Sorte einer Art als freies Feld mit Vorschlägen | 2 | **steht** | `Creature.kind`, `Place.kind`, `suggest` |

### F-004 Ebenen & Stapel

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-004 | Ebenen als Pakete von Inhalt | 1 | **steht** | `Layer.kind` system · expansion · world · pack · campaign · overrides, `order`, `version` |
| REQ-005 | Zugehörigkeit eines Artikels zu einer Ebene | 1 | **steht** | `inLayer` mit `mode` adds/removes; Überschreiben ist die Kante `overrides`; kein Pin |
| REQ-006 | Stapel: was in der Kampagne gilt | 1 | **teils** | Prototyp: `inStack`/`resolveArticle`; Server kennt nur die Zugehörigkeit (`campaignsOf`) — Abgleich A2 |
| REQ-007 | Stapel für Fortgeschrittene | 3 | **offen** |  |
| REQ-044 | Herkunft am Artikel sehen | 2 | **steht** | Herkunft am Artikelkopf, Ansicht `stack` |
| REQ-045 | Ebenen-Aktionen am Artikel | 3 | **offen** |  |
| REQ-100 | Welt als Ebene | 1 | **teils** | `Layer.kind: world`; keine Mitglieder je Welt |
| REQ-102 | Artikel je Stapel und Wissen zeichnen | 2 | **teils** | Prototyp ja; Server ohne Stapel — Abgleich A2 |
| REQ-244 | Ebenen gruppieren | 2 | **steht** | `kind: group`, `partOf`, `resolvedStack` (T-088, E-022 b) |
| REQ-245 | Ebenen beschreiben sich selbst | 2 | **steht** | Titel, Kürzel, Beschreibung an der Ebene (T-088) |
| REQ-249 | Ebenen nach Herausgeber | 2 | **teils** | `publisherOf` und Herausgeber-Gruppen (T-094, T-109); Kategorien wie die Blocklist von 5e.tools offen |
| REQ-253 | Ebenen und Artikel kopieren | 3 | **offen** | später; Kopie ohne `overrides` |
| REQ-255 | Ebenen teilweise aufschalten | 2 | **steht** | `activates` mit Auswahl nach Bereich und Art (T-105) |

### F-005 Fassungen & Varianten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-008 | Varianten einer Sache | 1 | **teils** | Kante `variantOf` da; kein Kopierknopf |
| REQ-009 | Überschreiben in der eigenen Ebene | 2 | **steht** | `overrides` in einer Ebene, Auflösung im Prototyp |
| REQ-108 | Lore der Kampagne abweichen lassen | 3 | **steht** | `overrides` in der Kampagnenebene |
| REQ-264 | Vergleichsebenen der Kampagne | 2 | **teils** | Vergleichsebenen an der Kampagne; Wahl im Kampagnen-Popup und gruppenweise offen |
| REQ-310 | Fassungen am Feld zeigen | 2 | **steht** | T-092, T-103 |

### F-006 Ansichten & Anordnung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-026 | Ansichten festlegen | 1 | **steht** | drei Ansichten, Anordnung am Typ (`InterfaceDef.views`) |
| REQ-164 | Darstellungsstufen als eigenes System | 2 | **ersetzt** | drei Ansichten; Bild, Token, Karte sind Elemente |
| REQ-256 | Ansichten ohne Code definieren | 1 | **steht** | Ansichten im Register, Anpassung je Art (T-110, E-030 b) |

### F-007 Verweise & Platzhalter

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-013 | Verweise nach Nummer, getippt nach Name | 1 | **teils** | `[[Verweise]]` nach Name und Alias, Vorschläge beim Tippen, `Rule.autolink`; kein Auto-Link beim Schreiben |
| REQ-014 | Rückbezüge sehen | 3 | **steht** | Rückbezüge in der Seitenleiste (`backlinks`) |
| REQ-174 | Regeltexte mit Platzhaltern | 2 | **steht** | `{VAR}`: Kante → Artikel → Kampagnenwerte → Register; ein Platzhalter trägt seinen Artikel, Satzanfang gross beim Lesen (D60) |
| REQ-175 | Regelbegriffe im Text erkennen | 3 | **steht** | `Rule.autolink` |
| REQ-176 | Ähnliches vor dem Anlegen vorschlagen | 3 | **teils** | Vorschläge nach Name und Alias; keine Ähnlichkeit |

### F-008 Kanten verstehen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-015 | Graph der Artikel | 4 | **offen** | Typdiagramm steht (Register › How it works); Artikelgraph nicht — Aufgabe #44 |
| REQ-257 | Kanten verständlich | 2 | **steht** | „How edges work“, Erklärung in Auswahl und Register (T-111) |

### F-009 Verlauf & gleichzeitiges Schreiben

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-003 | Änderungsverlauf je Artikel | 1 | **teils** | Server schreibt `event_log` (`entity.written`, `entity.deleted`); keine Anzeige, keine Kette |
| REQ-191 | Nichts still überschreiben | 1 | **steht** | Fail-closed im Prototyp; in der Seite: Schreiben nur gegen gelesene Revision, Entwurf herunterladbar |
| REQ-192 | Gleichzeitig bearbeiten ohne Verlust | 2 | **steht** | Revision je Artikel am Server (409), Zusammenführen in der Maske (mergeEntity) |

## EP-02 Zugang & Betrieb

Konten, Rollen je Kampagne, Sichtbarkeit und Wissen, Schreibrechte, API-Tokens, Werkbank, Ausrollen, Sicherung, Übernahme zwischen dev und prod, Leistung.

### F-010 Anmeldung & Konten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-031 | Anmelden mit Passwort | 1 | **steht** | Argon2id, Sitzung beim Server (Zugang.md) |
| REQ-032 | Anmeldung über Nextcloud/OIDC | 4 | **verworfen** | Entscheidung 2 (19.9.): kein SSO |
| REQ-033 | Konten | 1 | **steht** | `app_user` |
| REQ-034 | Einladen per Link | 2 | **steht** | Einladung, Konto selbst anlegen |
| REQ-228 | Verlorene Einladung neu ausgeben | 4 | **offen** | heute widerrufen und neu anlegen (W3) |
| REQ-229 | Konten in der Seite verwalten | 3 | **offen** | nur über `user` auf dem Server; die Kontoliste der Verwaltung steht in der Seite (W3) |
| REQ-266 | Demo-Zugang | 5 | **offen** |  |

### F-011 Rollen je Kampagne

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-035 | Rolle je Kampagne | 1 | **steht** | `campaign_member (campaign, user, role)`; Scope ist die Kampagne |
| REQ-036 | Leitung, Spieler und Verwaltung | 1 | **steht** | gm · co-gm · player · spectator; `is_admin` global |
| REQ-037 | Mitleitung und Zuschauer | 3 | **steht** |  |

### F-012 Sichtbarkeit & Wissen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-038 | Wer einen Artikel sieht | 1 | **steht** | `audience`, am Server ausgewertet (`articleVisible`) |
| REQ-039 | Sichtbarkeit mit Rollenlisten und Freigabemarken | 3 | **ersetzt** | drei Felder statt sechs; scope, Rollenlisten, sharedUsers weg (30.9.) |
| REQ-040 | Wissen zuteilen | 2 | **steht** | anders: `Information`/`Knowledge` als Artikel, `knownBy` an Träger |
| REQ-059 | Wissen über Arten von Kreaturen | 3 | **steht** | `Facts.fact#id` über eine Information |
| REQ-156 | Sichtbarkeit vererben | 2 | **verworfen** | `inherit` bewusst weg — kommt mit einer Tiefe wieder, wenn gebraucht |
| REQ-177 | Einzelne Felder freigeben | 2 | **steht** | `Information.fields` je Feld und je Eintrag |
| REQ-178 | Decknamen | 3 | **steht** | `Identity.cover` |
| REQ-179 | Zeigen, dass es mehr gibt | 4 | **steht** | „…and 3 more things" |
| REQ-203 | Wissen nach Rang in einer Fraktion | 2 | **steht** | `Faction.ranks`, `memberOf.props.rank`, `knownBy.props.rank` als Mindestrang (7.10., A7) |

### F-013 Schreibrechte & Freigabe

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-041 | Wer was schreiben darf | 2 | **teils** | Verwaltung oder eigene Figur (+ carries/holds/crafting); die Leitung fehlt in `mayWrite` |
| REQ-042 | Schreibrecht je Feldgruppe | 4 | **offen** |  |
| REQ-237 | Spielende legen Artikel an, die Leitung gibt frei | 2 | **steht** | `isReady`, `Viewer.own`, `entity_ready` (T-075, D72, D74) |
| REQ-242 | Felder der eigenen Figur sperren | 3 | **offen** | die eigene Figur verwaltet der Spieler ganz (E-014 d) |

### F-014 Sicht eines Spielers

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-241 | Die Sicht eines Spielers einnehmen | 1 | **steht** | Sicht eines Kontos am Server gerechnet (E-019 a) |

### F-015 API-Tokens & Werkzeugzugang

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-234 | API-Tokens für Werkzeuge | 3 | **steht** | `app_token`, Bearer `atm_…`, `read`/`write` mit Ablauf; `scripts/atlas.mjs` (W9) |
| REQ-268 | Dev-Token aus der Werkbank erzeugen | 3 | **teils** | Tokens am Konto in `konto/`; aus der Werkbank für andere Konten nicht |

### F-016 Werkbank

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-088 | Massenänderungen an Wissen und Rechten | 3 | **teils** | Massenbearbeitung ohne Wissen |
| REQ-235 | Werkbank: Prüfungen und Massenänderungen | 3 | **steht** | `/werkbank`: Prüfungen (`CHECKS`), `POST /api/bulk` mit Vorschau, `event_log` und Rückgängig (W9, D68) |

### F-017 Ausrollen & Sicherung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-154 | Ausrollen nach dev und prod | 1 | **steht** | Hetzner, Caddy, GHCR (Betrieb.md) |
| REQ-155 | Sicherungen | 2 | **steht** | Sicherung vor jedem Ausrollen; nächtliche als Rezept |
| REQ-199 | Produktionsdaten nach dev spiegeln | 3 | **steht** | Rezept in Betrieb.md, ohne Konten; `members` nicht in der Ausfuhr |
| REQ-267 | Eigenes Netz-VPS mit VPN | 5 | **offen** | bewusst später |
| REQ-269 | Ankündigen, wann produktiv gearbeitet werden kann | 2 | **teils** | Freigabe für verlierende Migrationen steht; Zusage und Ankündigung fehlen |

### F-018 Übernahme dev ↔ prod

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-270 | Artikel von dev nach prod übernehmen | 2 | **teils** | Übernahme (T-130) |
| REQ-271 | Konflikte bei der Übernahme nebeneinander lösen | 3 | **offen** | Konflikte werden heute nur gemeldet |

### F-019 Leistung & Laden

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-232 | Listen rechnet der Server | 2 | **steht** | `GET /api/list` mit Spalten aus `overview` und Facetten, 2 KB je Blatt in 15–40 ms; erster Aufruf eines Spielers nach einer Änderung ≈370 ms (W7, D66) |
| REQ-246 | Navigation ohne Einfrieren | 1 | **steht** | Stapel einmal gerechnet, Ladebanner, Startmeldung (T-086) |

## EP-03 Kreaturen & Figuren

Kreatur, Statblock (Vorlage und Instanz), Charakterbogen und Charaktermanager — alles, was eine Figur oder ein Monster beschreibt.

### F-020 Kreatur

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-046 | Creature / Statblock split with PC and NPC specializations | 1 | **steht** | `belongsTo`, `PlayerCharacter`; NPC ist `Creature.kind` |
| REQ-050 | Simple creature viewer: social / description / combat sections | 2 | **steht** | Reiter Overview · Combat · Gear · Craft · Ties |
| REQ-060 | Companions / summons as regular creatures via companionOf + overrides | 3 | **teils** | `Creature.kind` companion/summon; keine `companionOf`-Kante |
| REQ-105 | NPC directory as filtered view over creatures with relations | 3 | **steht** | Kompendium nach Art gefiltert |

### F-021 Statblock

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-052 | Detailed statblock viewer | 3 | **steht** | Statblock-Seite mit eingesetzten Regeln |
| REQ-053 | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | **steht** | `composedOf` mit `{VAR}`-Bindung |
| REQ-054 | Fightingtype field (MCDM roles) on statblock | 2 | **steht** | `Statblock.combatRole` |
| REQ-055 | Inline trait reuse & variant creation while typing | 3 | **offen** | Pool steht; Variante beim Tippen nicht |
| REQ-058 | Monster scaling | 5 | **offen** |  |
| REQ-062 | Multi-system statblock extension point (system reference on composition) | 5 | **offen** | `Statblock.system` als Feld vorhanden |
| REQ-272 | Statblock als Instanz einer Vorlage | 1 | **steht** | `instanceOf`, `resolveInstance`, `thinInstance` |

### F-022 Schnellanlage

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-048 | Minimal edit form for core creature fields | 2 | **steht** | Bearbeiten in der Ansicht und im Dialog |
| REQ-049 | Quick add: name-only NPC or statblock-only mob in one field | 2 | **steht** | Anlegedialog mit Statblock-Frage, Schnellanlage aus einem Verweis |

### F-023 Charakterbogen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-051 | Quick changes: HP, temp HP, conditions, rest, inspiration | 2 | **steht** | `Vitals` mit `alwaysEdit`, Bogen |
| REQ-063 | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | 2 | **steht** |  |
| REQ-066 | Character sheet: Combat tab (initiative, actions, companions) | 3 | **steht** | Reiter Combat; Initiative am Spieltisch |
| REQ-067 | Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) | 3 | **offen** | es gibt keine Art für Zauber — Abgleich A9 |
| REQ-068 | Character sheet: Freeplay tab | 4 | **offen** |  |
| REQ-073 | Custom / reorderable sheet layout | 4 | **ersetzt** | die Anordnung steht am Typ im Register, nicht je Nutzer |

### F-024 Charaktermanager

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-056 | Creature builder with suggestions (origin + fightingtype filter, grants applied via effects) | 4 | **offen** |  |
| REQ-057 | Point-buy ability setting | 4 | **offen** |  |
| REQ-222 | Stufenaufstieg: Schritte aus Klassen- und Unterklassentabellen (TP, Attributsverbesserung oder Talent, Zauber), Folgewerte gerechnet | 4 | **offen** |  |
| REQ-238 | Charaktererstellung aus den Artikeln: Klasse, Herkunft (Ancestry) und Hintergrund wählen und ihre Entscheidungen treffen; Schritte und Wahlmöglichkeiten kommen aus den Artikeln, nicht aus Code — eine Änderung am Artikel wirkt sofort | 1 | **steht** | Assistent für Figuren aus den Artikeln (T-080, E-015 a); Aufstieg mit Wahlen: REQ-222 |
| REQ-250 | Startausrüstung je Kampagne einstellbar: nach Regeln (Klasse/Hintergrund), Gold (fest oder gewürfelt) oder frei mit eigenen Grenzen (Goldbudget, höchstens N magische Gegenstände je Seltenheit u. ä.) | 2 | **steht** | Startausrüstung nach Kampagnenregel (T-096) |
| REQ-251 | Sprachen der Kampagne: die Kampagne nennt die sinnvollen/möglichen Sprachen; Sprachwahlen in der Charaktererstellung bieten genau diese an | 1 | **steht** | `Campaign.languages` (T-095) |
| REQ-273 | Eigene Verfahren für Attributswerte | 2 | **steht** | E-016 |
| REQ-274 | Charakter- und Kampagnenmanager jederzeit aufrufen | 3 | **offen** |  |

## EP-04 Spielererlebnis

Was Spielende sehen und tun: Spieleransicht und Telefon, eigene Figur und eigene Inhalte, Inventar, Chat.

### F-025 Spieleransicht & Telefon

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-069 | Phone-first responsive layout for all player-facing views | 1 | **teils** | Prototyp passt sich an; `apps/web` ist noch klein |
| REQ-074 | Quicklinks: campaign, quests, party, session | 3 | **teils** | Bereich Play und die Leiste |
| REQ-194 | Mobile navigation: the user chooses which entries occupy the phone bottom bar | 4 | **offen** |  |
| REQ-311 | Spieleransicht mit der eigenen Figur im Fokus | 2 | **teils** | Entwurf Player/PlayerPhone |

### F-026 Inventar

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-064 | Inventory as list: coins / attuned / worn / carried / stored / deeds | 2 | **steht** | `holds.tier`, `holds.slot` |
| REQ-065 | Tile-based visual inventory (alternative view over same data) | 4 | **steht** | Kachelraster, `Item.rows`, `Inventory.grid`/`zones` |
| REQ-183 | Party-owned inventory as a shared container distinct from character inventories | 3 | **steht** | `carries` von `Party` |
| REQ-214 | Ausrüstungsfigur nach dem Inventarblatt: Figur je Kreatur wählbar (männlich, weiblich, neutral) und dort gespeichert; Plätze Kopf, Schulter, Torso, rechte und linke Hand, Beine, Stiefel, Gurt mit zwei Holstern, Ringe je Hand, Halskette | 4 | **steht** | `Creature.figure`, Plätze des Blatts an `holds.props.slot`, Reiter „Worn“ mit Figur (Prototyp, D54) |
| REQ-215 | Tragraster aus Grösse und Statblock: ein Grundquadrat nach Grösse (Tiny 3 … Large 6) und ein Zusatzquadrat in der Grösse des Stärkemodifikators (+1 … +5) aus dem Statblock des Trägers — beim Lesen gerechnet, nie eingetippt | 3 | **steht** | `Statblock.carryExtra` gerechnet, Grundquadrat aus `carrySquares`; `carryGrid` im Modell, Prototyp (D54) |
| REQ-216 | Behälter in Behältern: jeder Behälter gibt eine Ziehstufe dazu, ausgehend davon, wo er selbst liegt; die Basiszonen kommen aus dem Blatt und sind je Behälter änderbar | 3 | **steht** | Ziehstufe die Kette hinauf (`drawStage`), `slotDraw`, Basiszonen `carryZones` und Vorlagen `container:*` (D54) |
| REQ-217 | Ziehen am Bogen: unter Aktion, Bonusaktion usw. je ein Eintrag „Ziehen“; ein Klick zeigt, was sich mit dieser Aktion herausnehmen lässt, mit Dauer | 3 | **steht** | Abschnitt „Actions“ am Bogen, je `DrawTime`-Stufe „Draw“ mit Weg (Prototyp, D54) |
| REQ-225 | Fallenlassen ist eine freie Aktion, Verstauen eine Bonusaktion, egal wohin; der Gurt ist eine freie Aktion | 3 | **steht** | „Drop“/„Stow“ am Bogen in der Zeile ihrer Kosten (Einstellung `handActions`), `tier: ground`, Gurt frei in `slotDraw`; `handActions`/`inHand` im Modell (Prototyp, D58) |
| REQ-275 | Erhaltene Gegenstände als Instanz | 2 | **teils** | `instanceOf` am Item vorhanden (T-150 läuft) |
| REQ-276 | Unverstaute Gegenstände gelten als liegengelassen | 4 | **offen** |  |
| REQ-277 | Gegenstände mit Form spiegeln | 4 | **offen** |  |

### F-027 Eigene Inhalte der Spielenden

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-072 | Player notes as owned documents | 2 | **offen** | `Notes` an Artikeln; kein eigener Notizartikel je Spieler |
| REQ-083 | Player-created quests and personal goals | 3 | **offen** | Spieler schreiben nur ihre Figur |
| REQ-109 | Player-authored ContentBlocks with per-view block-type whitelist | 3 | **teils** | Felder da (`Article.poem/song`); Schreibrecht offen (REQ-041) |

### F-028 Chat

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-200 | Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung | 3 | **offen** |  |
| REQ-201 | Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle | 3 | **offen** |  |
| REQ-202 | Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit | 2 | **offen** |  |

## EP-05 Kampagne & Sitzungen

Kampagnenmanager, Bereich Story (Arcs, Quests, Szenen), Sitzungen und Vorbereitung, Begegnungen, Abenteuer übernehmen, Party, Ladebildschirm.

### F-029 Kampagne

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-043 | Campaign configuration store: key-value, each area interprets its keys | 2 | **steht** | Registerteil `settings` |
| REQ-075 | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | 1 | **steht** | `Campaign`, `settings`, Zeitleiste |
| REQ-236 | Kampagne anlegen mit Dialog: Name, aufgeschaltete Ebenen (Liste mit Häkchen und Reihenfolge, vorhandene vorausgewählt), eigene Kampagnenebene, Leitung | 2 | **offen** | Kampagne anlegen ohne Dialog |
| REQ-278 | Bereiche als eigene Seiten | 1 | **steht** | `area` am Typ |
| REQ-279 | Kampagnenwerte pflegen und in Texten nutzen | 2 | **teils** | Auflösung steht; Maske fehlt |

### F-030 Bereich Story

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-076 | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | 1 | **steht** | `Story` (`kind`: adventure …) · Campaign · Arc · Session · Scene, Hierarchie über `partOf` |
| REQ-080 | Readaloud blocks unlocking for players after session (time/event-based grant) | 3 | **offen** |  |
| REQ-082 | Quests with tasks, rewards, restrictions; player-facing quest board with gated GM parts | 3 | **steht** | `Quest.tasks`, `reward`, `restriction`; Auftragsbrett |
| REQ-180 | Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in | 3 | **offen** | keine Art und kein Feld für gepflanzte Fäden |

### F-031 Sitzungen & Vorbereitung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-077 | Session documents with planned vs occurred encounters and reports | 2 | **steht** | `Session`, `Encounter.phase` |
| REQ-078 | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | 2 | **steht** | Element `prep` |
| REQ-079 | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | 2 | **teils** | Wissen zuteilen im Seitenpanel; kein Ein-Tipp-Knopf in der Sitzung |
| REQ-084 | Ideas inbox per campaign/player and clean vs planning view toggle | 3 | **steht** | Unfinished, Todos |
| REQ-188 | Cross-type "unfinished" overview: everything at status idea/planned across all interfaces, with jump-to and bulk status change | 3 | **steht** | Unfinished |
| REQ-189 | Aggregated todo list across containers and entities (campaign, arc, session, quest, NPC) | 3 | **steht** | `Todos`, gesammelt |
| REQ-190 | Quick capture during play: one field that files a seed, todo or idea against the current session without leaving the view | 3 | **steht** | Schnellerfassung an der Sitzung |
| REQ-280 | Umschalter Vorbereitung und Spiel | 4 | **offen** | ob nötig, ist offen |
| REQ-282 | Sitzungsansicht für das Spiel | 2 | **offen** | Vorbereitungsseite steht (REQ-078), Spielansicht nicht |

### F-032 Begegnungen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-085 | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | **steht** | `Encounter`, `participates`, `onMap`, `loot`, `tableFor` |
| REQ-172 | Weighted encounter tables per region, with per-location type constraints and safety states that restrict the pool | 3 | **steht** | `entry.weight`, `requiresTag`, `tableFor` |
| REQ-173 | World-state decay between sessions: roll to degrade secured locations, weighted by adjacency to faction territory | 4 | **offen** |  |
| REQ-221 | Begegnungsbau: Schwierigkeit aus den XP-Schwellen der Gruppe mit Multiplikator nach Anzahl (2014), Kreaturen aus dem Kompendium, dann auf die Karte setzen und Initiative starten | 3 | **offen** |  |

### F-033 Abenteuer übernehmen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-240 | Vorgefertigte Abenteuer aus 5e.tools: je Abenteuer eine Ebene mit Kapiteln, Abschnitten, Begegnungen, Karten und NSC als Artikeln; die Leitung übernimmt sie in die eigene Geschichte und passt sie an, ohne das Original zu verlieren | 2 | **steht** | je Abenteuer eine Ebene mit Kapiteln aus Teilen (T-082, T-108, E-018, E-029) |
| REQ-252 | Abenteuer modular: Kapitel als Arcs, Begegnungen und Karten als eigene Szenen; einzelne Vorlesetexte oder ganze Kapitel in die eigene Kampagne übernehmen | 2 | **steht** | `take` mit allem darunter (E-026) |

### F-034 Party

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-086 | Party view: passive perception, feats, inventory overview | 3 | **teils** | Party-Seite mit Inventar und Werkbank; keine Übersicht der passiven Wahrnehmung |
| REQ-122 | Widget: party overview | 3 | **steht** | Party-Seite |
| REQ-281 | Eine Party je Kampagne | 1 | **steht** | `Party`, `partyOf`, `memberOfParty` (T-100, E-007) |

### F-035 Ladebildschirm-Board

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-283 | Kampagnen-Ladebildschirm | 3 | **offen** |  |

### F-036 Sitzungsmitschnitt

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-196 | Sitzungsmitschnitt: Audio einer Sitzung aufnehmen oder eine fertige Aufnahme anhängen, als Asset am Sitzungs-Container, mit Startzeit und Kapitelmarken | 4 | **offen** |  |
| REQ-197 | Transkription und Recap-Entwurf: Mitschnitt transkribieren, am Sitzungsverlauf ausrichten und daraus einen Recap-Entwurf erzeugen, den die SL bearbeitet | 4 | **offen** |  |
| REQ-198 | Sprecherzuordnung im Transkript: Abschnitte einer Figur oder der SL zuordnen, damit „was hat meine Figur mitbekommen“ beantwortbar wird | 5 | **offen** |  |

## EP-06 Welt & Lore

Bereich World: Orte, Fraktionen, Gottheiten, Lore, Kalender und Zeitleisten, Beziehungen, Läden und Wirtschaft.

### F-037 Bereich World

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-101 | Lore articles: categories, composed of ContentBlocks | 2 | **steht** | `Article` mit poem/song |
| REQ-103 | Locations: hierarchy via parent, type, biome | 2 | **steht** | `Place.kind`, `environment`, `partOf` |
| REQ-104 | Factions: type/subtype taxonomy, relations | 2 | **steht** | `Faction.kind`, `controls`, `memberOf` |
| REQ-107 | Pantheons / deities as article subtype | 4 | **offen** | eine Zeile, wenn gebraucht |
| REQ-110 | Bibliothek von Tan'Jit: illustrated navigation presentation layer over articles | 5 | **offen** | Aufgabe #59 Portal |

### F-038 Kalender & Zeitleisten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-024 | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | 1 | **steht** | `Time.sort` (sortierbar), `Time.display`, `Time.calendar` |
| REQ-025 | CalendarSystem definition: months, eras, moons, configurable per world/system | 3 | **offen** | nur die Einstellung `calendar`; keine Kalenderzeile |
| REQ-087 | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | 5 | **offen** |  |
| REQ-106 | Events & timelines sorted by WorldDate | 3 | **steht** | `Event`, `Time`, Element `timeline` |
| REQ-220 | Zeitleisten der Weltgeschichte: mehrere Spuren (ein Krieg, eine Dynastie, Zeitalter) neben der Kampagnenzeitleiste; ein Ereignis mit Spanne enthält seine Ereignisse, und die Kampagne ist eine Spur unter ihnen | 3 | **steht** | Spuren = `Event` mit Spanne, Inhalt über `partOf` (D57), Kampagne als Spur; `worldHistory` im Modell, Reiter im Element `timeline` (Prototyp) |

### F-039 Beziehungen & Ruf

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-030 | Reputation hooks: weighted tags on relations, propagation rule slot reserved | 2 | **ersetzt** | Kante `regards` mit Marken (Beziehungen.md) |
| REQ-061 | Creature relations (creature ↔ creature / faction) with relation type | 2 | **steht** | `owes`, `memberOf`, `livesIn`, `regards` |
| REQ-081 | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | 4 | **ersetzt** | siehe REQ-030 |

### F-040 Läden & Wirtschaft

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-185 | Non-coin economies: barter and alternative currency ladders per region | 5 | **offen** |  |
| REQ-284 | Läden mit Waren und Preisen | 2 | **steht** | T-129, T-133 |
| REQ-285 | Fraktionspreise | 3 | **teils** | `discount` nach Rang, `controls` |

### F-041 Namensgenerator

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-254 | Namensgenerator: Namen für NSC, Orte usw. erzeugen (z. B. aus den Namenstabellen der Abstammungen/Kulturen), übernehmbar beim Anlegen | 4 | **offen** | später |

## EP-07 Regeln & Nachschlagen

Bereich Rules und Kompendium, Bücher und Leseansicht, Klassen, Zauber, Zustände, Handwerk, Regelsysteme und die Auswertung von Regeln.

### F-042 Bereich Rules & Kompendium

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-089 | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | 1 | **steht** | `Rule`, `Feat`, `Skill` |
| REQ-091 | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | 2 | **steht** | Bereich Rules mit Filter |
| REQ-094 | Entity ↔ rule attachment as layer-scoped relation | 2 | **steht** | `hasProperty`, `composedOf`; die Ebene über `inLayer` |
| REQ-098 | Sub-5-second rule lookup during play | 2 | **steht** | Verweise im Text, Merkzettel |
| REQ-099 | Pinnable rules: bookmark object (user + context + rule) | 3 | **steht** | Merkzettel (pinned) |
| REQ-313 | Zustände als Artikel | 2 | **teils** | Wirkung `affects` gespeichert, nicht ausgewertet |

### F-043 Bücher & Leseansicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-247 | Leseansicht für Bücher und Abenteuer: eine Ebene als Buch lesen — Inhaltsverzeichnis, Kapitel in Reihenfolge, eingebettete Artikel (Zauber, Monster, Tabellen) als Verweise bzw. Karten, Lesestand gemerkt | 2 | **steht** | `/read/:layer` mit Inhaltsverzeichnis, Suche, Lesestand (T-091, T-108) |

### F-044 Klassen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-231 | Klassenansicht wie 5e.tools: Stufentabelle (Übungsbonus, Merkmale, Spalten der Klasse und gewählter Unterklassen), Merkmale je Stufe ausgeschrieben, optionale Merkmale und Varianten zuschaltbar, Unterklassen nach Name und Quelle filtern und mehrere nebeneinander vergleichen (am Telefon untereinander) | 3 | **steht** | `/classes`: Stufentabelle, Merkmale je Stufe, optionale zuschaltbar, Unterklassen filtern und vergleichen (`classes.ts`, W6, D65) |

### F-045 Zauber

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-092 | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | 2 | **offen** | keine Art für Zauber — Abgleich A9 |
| REQ-097 | Spell lists as relations (class ↔ spell) | 3 | **offen** | braucht REQ-092 |

### F-046 Regelauswertung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-017 | Term engine bindings: system-specific semantic evaluation of rule terms | 4 | **offen** |  |
| REQ-018 | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | 1 | **offen** | keine `effects[]`; Regeln sind Text mit `{VAR}` |
| REQ-093 | Rule engine per system evaluating rules against entity data (constraints, terms) | 5 | **offen** |  |
| REQ-095 | Effects interpreter for grants (first consumer: creature builder) | 4 | **offen** |  |
| REQ-096 | Constraint interpreter (first consumer: settlement / building validation) | 5 | **offen** |  |
| REQ-290 | Wechselwirkungen von Regeln auswerten | 4 | **offen** | für später |

### F-047 Handwerk

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-184 | Crafting: recipes with material inputs, skill checks and DC, time, and output; consumption on completion | 4 | **steht** | `Recipe`, `needs`, `yields`, `crafting` |
| REQ-218 | Blaupausen werden gelernt: alle Rezepte sind sichtbar, ungelernte mit „muss noch gelernt werden“ (ohne festen Fundort); Filter „kann der Charakter“ und „alle“, „machbar“ und „fast“, nach Material und nach Beruf | 3 | **steht** | gelernt über `knownBy`, Werkbank mit Filtern (Prototyp, D55) |
| REQ-219 | Material wird beim Start an den Vorgang gebunden: es verlässt den Vorrat und kann nicht doppelt oder anderweitig gebraucht werden; was beim Misslingen zurückkommt, sagt `Recipe.onFailure` | 3 | **steht** | beim Start gebunden in `crafting.props.put`, `onFailure` (D55) |

### F-048 Regelsysteme & Module

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-223 | Regelsysteme als Rahmen (Taverne, Alley, Kanalisation): ein Ort, seine Kennzahlen, ein Wochenwurf und ein Protokoll | 4 | **offen** |  |
| REQ-287 | Regelsysteme als Behälter mit Optionen | 2 | **offen** | E-044, T-132 |
| REQ-289 | Homebrew-Regeln erfassen | 3 | **offen** | wenn das Gerüst steht |

### F-049 Masse & Einheiten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-227 | Masse im Fliesstext umrechnen: Fuss und Meilen in Regeltexten („within 120 feet“) nach der Einstellung `units` zeigen, beim Lesen gerechnet, gespeichert bleibt der Wortlaut | 3 | **offen** | umgerechnet werden nur Felder mit `unit` und Angriffszeilen (`convertText`, W2) |

## EP-08 Live-Spiel

Bereich Play: Spielleiter-Schirm, Initiative, Sitzungszustand und Live-Kanal, Würfel, Werkzeuge am Tisch.

### F-050 Spielleiter-Schirm

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-187 | Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts | 3 | **offen** |  |
| REQ-204 | Spielleiter-Schirm je Kampagne: Fenster (mehrere Bildschirme als Browser-Reiter), darin Plätze, die ein Board oder ein Werkzeug zeigen; zuklappbar, umstellbar, zwischen Fenstern verschiebbar | 3 | **offen** |  |
| REQ-205 | Ein Board je Geschichtsartikel (Kampagne, Kapitel, Sitzung, nicht Szene) und Regel-Boards; der Schirm schaltet zwischen ihnen, die Artikelansicht filtert nach Artikeln aus den offenen Boards | 3 | **teils** | ein Board je Geschichtsartikel über `partOf`, Liste und Anlegen in der Seite (W4, D63); offen: Umschalten auf dem Schirm, Filter nach Artikeln aus offenen Boards |

### F-051 Initiative

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-115 | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | 2 | **steht** | `participates` mit init, hp, conditions (je Eintrag ein Artikel der Art `Condition`, Runden, Quelle) |
| REQ-128 | Combat player view: own initiative, conditions, health comments | 3 | **teils** | dieselbe Ansicht, gesiebt |
| REQ-144 | Initiative indicator on battlemap (current / next) | 4 | **steht** |  |
| REQ-211 | Initiative wie Improved Initiative: je Zeile Initiative, RK, TP und Zustände, aus der Zeile der Statblock | 2 | **steht** | Prototyp: RK und TP-Maximum vom Statblock der Instanz (`participantStats`), Statblock in `quick` neben der Reihe (D53) |
| REQ-212 | Zustände und Notizen mit Dauer: Anzahl Runden, Anker (wessen Zug) und Zeitpunkt (Anfang oder Ende dieses Zuges); eine Notiz ist ein freier Text mit derselben Dauer | 2 | **steht** | `anchor`/`at` an `participates.props.conditions`, Notiz mit `text`; `tickEntries`, `expiresAt` (D53) |
| REQ-213 | Initiative der Spielenden: die eigene Reihenfolge und jede Kreatur, die aufgedeckt oder schon beteiligt ist; nicht erkannte Kreaturen mit Decknamen, TP von Gegnern als Wort | 3 | **steht** | `redactParticipants` in `redactEntity` und im Prototyp; `turn` geht nicht an Spielende, `props.current` statt dessen (D53, D58) |
| REQ-226 | In der ersten Runde erscheinen Gegner in der Initiative der Spielenden erst, wenn sie an der Reihe sind; ab der zweiten Runde stehen die bereits gezeigten fest | 3 | **steht** | Runde 1: Gegner erst in ihrem Zug (`turnHasCome`, `initiativeOrder`), in `redactParticipants`/`redactEntity` und im Prototyp (D58) |

### F-052 Sitzungszustand & Live-Kanal

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-116 | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | 2 | **steht** | `Session.activeMap/activeEncounter/activeScene`; Raum-Kanal für Augenblicke |
| REQ-117 | Stewardship: write permission on a state object per user, GM override configurable | 3 | **steht** | `Session.stewardship` gm/table |
| REQ-120 | Play log: persist state events (actor, target, delta) | 3 | **teils** | Würfe im Protokoll; Zustandsereignisse nicht gespeichert |
| REQ-121 | Statistics widget: kills, damage per character, monsters faced, records | 4 | **offen** |  |

### F-053 Würfel

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-070 | Local dice roller (selector, modifiers, results) | 2 | **steht** |  |
| REQ-071 | Shared rolls & roll log per session | 4 | **steht** | Würfe über den Raum-Kanal, Protokoll |

### F-054 Werkzeuge am Tisch

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-112 | Widget: reference box holding multiple open articles with inner tabs | 2 | **ersetzt** | Platzierungen auf dem Board |
| REQ-113 | Widget: notes | 2 | **offen** | Aufgabe #58 |
| REQ-114 | Widget: quick-create (creates entries in the campaign layer inline) | 2 | **teils** | Anlegen aus dem Board |
| REQ-118 | Widget: encounter runner — instantiate participants, roll random entries, raw statblocks trackable | 3 | **steht** | Begegnung mit Teilnehmern und Tabellen |
| REQ-123 | Widget: timers | 3 | **offen** |  |
| REQ-124 | Widget: quest board | 3 | **steht** | Element `quests` |
| REQ-125 | Widget: random tables & generators (names, shops, loot, cities) | 3 | **steht** | `Table.kind` loot · encounter · name · shop · event · generic |
| REQ-126 | Widget: sound — embed/link external tool, native now-playing state only | 4 | **teils** | `Session.nowPlaying` als Feld; kein Einbetten |
| REQ-127 | Native soundboard / music engine | 5 | **offen** |  |
| REQ-129 | Chatbot: rules Q&A, facts, quick edit | 5 | **offen** |  |
| REQ-186 | Nested loot tables: a table entry may reference another table, with cycle protection | 3 | **steht** | `entry` auf eine Tabelle |
| REQ-292 | Neuen Artikel aus einer Auswahl anlegen | 2 | **teils** |  |

## EP-09 Karten

Karte und Kartenebenen, Tokens und Marker, Nebel, Licht und Sicht, Bewegung und Zonen, Gebiete, Reisen, Karteneditor.

### F-055 Karte & Kartenebenen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-130 | Map entity: image asset, scale, grid config (size, offset, square/hex), link to Location | 3 | **steht** | `Map` mit Gitter, Massstab, `mapOf` |
| REQ-131 | Nested maps: parent + anchor region, zoom-through transitions world → region → city → district → battlemap | 3 | **steht** | `insideMap` mit Rahmen, Hineinzoomen |
| REQ-132 | Level lock: pin current map level while zooming | 3 | **offen** |  |
| REQ-138 | Map tiling for smooth zoom (derived asset) | 4 | **steht** | `Map.tiles` |
| REQ-293 | Ladeanzeige für Kartenbilder | 3 | **steht** | T-126 |

### F-056 Tokens & Marker

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-133 | Static tokens: reference markers linked to entities (pin opens article) | 3 | **steht** | `marker` |
| REQ-134 | Static tokens: scenery / props as part of prepared map state | 4 | **steht** | `marker.kind: scenery` |
| REQ-135 | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | 3 | **teils** | Tokens als Kanten; keine getrennte Lebensdauer je Sitzung |
| REQ-136 | Party and quest markers on region maps (campaign-scoped play tokens) | 3 | **steht** | Gruppen-Token, `{PARTYWHERE}` |
| REQ-224 | Kreaturen nehmen auf der Karte Felder nach ihrer Grösse ein (Regeln 2014): Tiny, Small, Medium, Large 2 × 2, Huge 3 × 3, Gargantuan 4 × 4; Bewegung, Wege, Sicht und Reichweite rechnen mit dem ganzen Platz | 3 | **steht** | Platz nach `Statblock.size` beim Lesen (`sizeSpan`, Instanz über `resolveInstance`), gespeichert die Mitte, gerechnet über den Anker; Rechner mit `MoveGrid.span` (ganzer Platz passt, Wände je Feld, teuerstes neu betretenes Feld), Sperren und Reichweite vom ganzen Platz, Sicht Feld zu Feld (`bestNotice`); tiny teilt (D58) |
| REQ-294 | Token ohne Bild zeigt den Anfangsbuchstaben | 3 | **teils** | Anfangsbuchstabe ja; Deckname nicht geprüft |

### F-057 Nebel, Licht & Sicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-139 | Fog of war | 4 | **steht** | `Map.reveal` |
| REQ-140 | Light & line of sight with walls | 5 | **steht** | `marker.light/dim`, `Map.walls`, `visionPoly` |
| REQ-209 | Aufdecken: von Hand oder beim Bestätigen einer Bewegung, dann entlang des Pfads Schritt für Schritt; von Hand zeigt das Token, wen es sieht und von wem es gesehen wird (Sichtlinie, passive Wahrnehmung gegen Heimlichkeit, −5 im Dämmerlicht) | 3 | **steht** | Sieht / wird gesehen von am gewählten Token, Aufdecken von Hand; beim Bestätigen entlang des Pfads Schritt für Schritt (Tokens, versteckte Zonen, Nebel); Sichtlinie, PP gegen Heimlichkeit, −5 im Dämmerlicht (`sight.ts`, D56) |

### F-058 Bewegung & Zonen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-206 | Bewegungsrechner auf der Karte: Diagonalen 5-10-5, gezählt je Kreatur und Zug und mit jedem Zug neu; Modi „genauer Weg“, „grösste Reichweite“, „aus“; das Tempo des Zuges ist eine Zahl, die man ändert (Spurt, Klettern, Schwimmen, Sonderfälle), und die SL darf übersteuern | 3 | **steht** | Rechner 5-10-5 über Feld × Parität (`movement.ts`, Prototyp `mvSearch`), Modi genau · Reichweite · aus, Tempo als Zahl in `Session.moves` mit Kurzwahl, SL setzt frei und bestätigt über das Tempo hinaus; nur Quadratraster (D56) |
| REQ-207 | Wählbarer Pfad: Wegpunkte setzen (um eine Falle herum, nicht an einem Gegner vorbei), zwischen ihnen der günstigste Weg; die Diagonalenzählung läuft über die Wegpunkte weiter; Gefahren und Reichweite von Gegnern können gemieden werden | 3 | **steht** | Wegpunkte per Klick, günstigster Weg dazwischen, Parität läuft weiter (`pathVia`); Gefahren und Reichweite von Gegnern meidbar (D56) |
| REQ-208 | Zonen mit eigenen Regeln: eine Zonenart ist ein Regelartikel; Bewegungskosten, Licht, Sicht und „versteckt bis passive Wahrnehmung n“ rechnet die Karte, Schaden, Rettungswurf, Zustand und freie Regeln zeigt sie und schreibt sie beim Betreten ins Protokoll | 3 | **teils** | `ZoneKind` (Regelartikel) + Kante `zone`: Kosten, Licht und Verdeckung in Weg und Sicht, versteckt bis PP n; Schaden/Rettungswurf/Zustand gezeigt und beim Betreten in `Session.log`. Offen: Auslöser zu Zugbeginn/-ende, Zonenlicht in der Dunkelheitsmaske (D56) |
| REQ-210 | Karte und Initiative je als Vollbild, je mit SL- und Spieleransicht; Spielende bewegen ihre eigenen Tokens und prüfen die Reichweite selbst | 3 | **teils** | Prototyp: Vollbild für Karte und Initiative, SL-/Spieleransicht der Karte, Spielende bewegen eigene Tokens; offen: `redactEntity` hält versteckte Marker am Server nicht zurück (D56) |
| REQ-312 | Eigenes Token bewegen | 2 | **teils** | Prototyp ja; in der Seite noch nicht für Spielende |

### F-059 Gebiete & Overlays

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-137 | Overlays: query-driven highlights (faction locations, biomes, routes) | 4 | **teils** | `territory` von Hand; keine Abfrage |
| REQ-193 | Territory overlays rasterised onto the map grid from shapes (rect, circle, ellipse, polygon) | 4 | **steht** | `territory` |

### F-060 Reisen & Erkundung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-168 | Point-crawl travel: node/edge graph attached to a Location, with per-edge sensory read-aloud text and per-node arrival state | 3 | **steht** | `route` mit signal, `Place.state` |
| REQ-169 | Exploration state ladder per map feature (verborgen → entdeckt → erkundet) with cascade: exploring a node reveals its edges as discovered | 3 | **steht** | `Place.state` hidden · discovered · explored |
| REQ-170 | Travel resource cadence: consumables consumed every N nodes or watches, configurable per travel ruleset | 4 | **steht** | Einstellungen `travel*`, `Party.sinceRation/sinceLight` |
| REQ-171 | Per-node action budget: one action per character per node from a configurable list (sneak, craft, forage, rest) | 4 | **steht** | `Party.actions`: Figur → Regelartikel `kind: travel` |

### F-061 Karteneditor

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-141 | Map effects & animations (conditions, weather) | 5 | **offen** |  |
| REQ-142 | Drawing, stamps, brushes, layers on maps | 5 | **offen** | Aufgabe #60 |
| REQ-143 | Map editor / full map creation | 5 | **offen** |  |

## EP-10 Medien & Assets

Bilder und Dateien: Ablage, Bildverwaltung und Bildklassen, Token-Werkstatt, Druck und Ausfuhr, PDF.

### F-062 Asset-Ablage

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-020 | SourceRef provenance: publication, page, optional file + page anchor | 1 | **steht** | `Source`: publication, page, anchor, url |
| REQ-021 | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | 1 | **steht** | `Asset`: backend app/external, ref, mime, width, height, bytes |
| REQ-022 | Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side | 3 | **offen** |  |
| REQ-145 | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | 1 | **teils** | Assets als Artikel; Ablage im Artefakt |
| REQ-146 | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | 2 | **offen** |  |
| REQ-148 | External URL assets | 3 | **steht** | `Asset.backend: external` |
| REQ-150 | Audio asset storage | 5 | **offen** |  |
| REQ-151 | 3D file viewer / repository | 5 | **offen** |  |

### F-063 Bildverwaltung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-147 | Image upload, portraits, icons | 2 | **teils** | Prototyp ja; Server noch nicht |
| REQ-295 | Bild ersetzen als Fassung oder neue Quelle | 3 | **offen** |  |
| REQ-296 | Bildklassen | 3 | **teils** | `Asset.kind` (T-119); Übersicht fehlt |
| REQ-297 | Bilder aus 5e.tools einlesen und verknüpfen | 3 | **offen** |  |

### F-064 Token-Werkstatt

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-298 | Bilder bearbeiten und Tokens zusammenstellen | 4 | **offen** |  |

### F-065 Druck & Ausfuhr

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-029 | Serializable schema / export (future file or git backing) | 3 | **steht** | Ausfuhr/Einfuhr als eine Datei; Register allein (`register-datei.mjs`) |
| REQ-167 | Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config | 3 | **offen** |  |
| REQ-195 | Statblock export back to Obsidian markdown, preserving `{VAR}` placeholders unresolved | 4 | **offen** |  |

### F-066 PDF & OCR

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-149 | PDF viewer with page-anchor jump from SourceRef | 4 | **offen** |  |
| REQ-152 | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | 5 | **offen** |  |

## EP-11 Oberfläche & Navigation

Boards, Suche, Filter und Filtergruppen, Navigation und Kurzansicht, Bearbeiten in der Ansicht, Design und Stilkonzept.

### F-067 Boards

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-111 | Boards: user-owned configurable views with tabs/pages and widgets; DM and player boards share the mechanism | 2 | **steht** | `Board`, `placed` |
| REQ-119 | Player boards | 3 | **offen** |  |
| REQ-157 | Canvas boards: free positioning, scaling and arrangement of entity placements on a board (Figma/Canva-style), beyond the widget grid | 2 | **steht** | `placed` mit x, y, w, h, z; in der Seite die Leinwand `/boards` (W4) |
| REQ-158 | Placement rendering: each placement resolves to a facet/renderer via the display resolution; explicit per-placement override always wins | 2 | **steht** | `placed.view` |
| REQ-159 | Frames / viewpoint anchors: named canvas viewports (position, zoom depth, target facet, visible layers), persisted in the board config | 3 | **steht** | `Board.anchors`; in der Seite als Reiter über dem Board, mit Rechteck ein einklappbarer Bereich (T-073) |
| REQ-160 | Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board | 3 | **teils** |  |
| REQ-161 | Display resolution as priority system: entity profile proposes, board rules (per interface / attribute value) decide, user overrides; placement override wins; ties → board rule; works board-only | 2 | **steht** | `Board.rules`, `placed.view`; ohne beides wählt die Grösse der Kachel (`placementView`, D63) |
| REQ-162 | Semantic zoom: zoom depth maps onto facets (compact list of weapon properties → full detail on zoom-in); anchors may store a target facet | 4 | **offen** |  |
| REQ-165 | Board placements beyond content entities: assets (images, icons), geometric/mathematical shapes as inline canvas objects, and tool objects (interactive widgets such as creature creator or generators) on the canvas | 2 | **steht** | `Board.shapes`, Assets als Platzierung (Prototyp); die Seite zeichnet Anker und Bereiche (T-073), Formen noch nicht (W4) |
| REQ-166 | Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow | 2 | **teils** | Anlegen auf dem Board |
| REQ-291 | Leseansicht auf dem Board | 3 | **offen** |  |

### F-068 Suche

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-028 | Full-text search across content | 3 | **teils** | Suche am Server über Name, Alias, Deckname und Nummer, Feldfilter als Facetten (`GET /api/list`, W7); keine Volltextsuche |
| REQ-304 | Übergreifende Suche beim Tippen | 1 | **steht** | T-138 |

### F-069 Filter & Filtergruppen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-302 | Der Filter gehört der Seite | 3 | **steht** | `goPage` |
| REQ-303 | Filtergruppen je Seite | 2 | **steht** | T-137, `list_filter` |

### F-070 Navigation & Kurzansicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-248 | Kurzansicht überall: wo ein Artikel genannt wird (auch Ebenen in Filtern, Chips, Listen), öffnet ein Klick bzw. Antippen ein Popup mit der Quick-Ansicht und einem Link zum Artikel; Brotkrumen für die Navigation | 2 | **steht** | `nwQuick`, `nw-kurzpopup`, Brotkrumen (T-093) |
| REQ-305 | Kampagne und Ebene immer sichtbar | 2 | **offen** | T-143 läuft |
| REQ-315 | Globale Kopfleiste | 1 | **steht** |  |

### F-071 Bearbeiten in der Ansicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-299 | Optionale Felder verdeckt | 3 | **teils** |  |
| REQ-307 | Löschen mit Rückfrage in der Seite | 3 | **steht** |  |

### F-072 Design & Stilkonzept

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-153 | German UI output with i18n-ready string handling | 2 | **ersetzt** | Oberfläche englisch (19.9.) |
| REQ-300 | Gestaltung wie die Bücher | 3 | **teils** | Pergament in `apps/web`; Design-Lauf offen |
| REQ-301 | Stilkonzept in der Verwaltung anpassen | 4 | **offen** |  |
| REQ-306 | Lesbarkeit im Feinschliff | 3 | **steht** | T-126 |

## EP-12 Import & Inhalte

5e.tools, Regelwerke anderer Verlage, Obsidian-Vault, Artikelprüfung und KI-erzeugte Inhalte — wie Inhalte hereinkommen und vollständig werden.

### F-073 5e.tools-Import

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-047 | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | 2 | **verworfen** | Importer entfernt; wiederkommen heisst neu schreiben |
| REQ-090 | Rule import from Obsidian markdown and 5e.tools data | 2 | **verworfen** | siehe REQ-047 |
| REQ-233 | 5e.tools über eine Pipeline einlesen statt von Hand auf dem Server: dev von selbst, wenn sich der Importer ändert, prod nur von Hand; vorher eine Sicherung, ein Probelauf ist möglich, der Bericht steht im Lauf | 3 | **steht** | `import-5etools.yml` und `deploy/import.sh`, `--only-new` (Vorgabe), `--replace-layer` nur ausdrücklich, `--dry-run`; nur von Hand, dev wie prod (W8, D67, D71) |
| REQ-239 | Jedes Buch eine eigene Ebene (PHB, MM, DMG, XGE …), statt einer Ebene für alles aus 5e.tools; eine Kampagne schaltet die Bücher auf, die sie nutzt | 2 | **steht** | je Quelle eine Ebene (T-087) |
| REQ-243 | Alle 5e.tools-Inhalte als eigene Ebenen, abschaltbar: 2024-Regeln, Unearthed Arcana, Fahrzeuge, Kartendecks, Bastionen — damit die Leitung Ebenen umschalten und Fassungen eines Artikels nebeneinander zeigen kann | 2 | **steht** | jeder Regelstand in seiner Ebene (T-087) |

### F-074 Regelwerke anderer Verlage

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-314 | Regelwerk eines Drittverlags laden | 3 | **teils** | T-122 |

### F-075 Obsidian-Vault

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-308 | Obsidian-Vault einlesen | 3 | **offen** | die alten Importer sind weg (2026-09-20) |

### F-076 Artikelprüfung & Nachtarbeit

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-286 | Artikel nachts auf Vollständigkeit prüfen | 3 | **steht** | T-089 |
| REQ-309 | Claude darf auf dev ergänzen, mit Protokoll | 3 | **steht** | E23 |

### F-077 KI-Inhalte

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-288 | Preise für jeden Gegenstand | 3 | **teils** | T-139 (`priceNote`) läuft |

## Was offen ist und wehtut

Offene und teilweise Stories mit Priorität 1 bis 3, nach Priorität:

- **REQ-003** (1, teils, Inhaltsgerüst) — Änderungsverlauf je Artikel — *Server schreibt `event_log` (`entity.written`, `entity.deleted`); keine Anzeige, keine Kette*
- **REQ-006** (1, teils, Inhaltsgerüst) — Stapel: was in der Kampagne gilt — *Prototyp: `inStack`/`resolveArticle`; Server kennt nur die Zugehörigkeit (`campaignsOf`) — Abgleich A2*
- **REQ-008** (1, teils, Inhaltsgerüst) — Varianten einer Sache — *Kante `variantOf` da; kein Kopierknopf*
- **REQ-013** (1, teils, Inhaltsgerüst) — Verweise nach Nummer, getippt nach Name — *`[[Verweise]]` nach Name und Alias, Vorschläge beim Tippen, `Rule.autolink`; kein Auto-Link beim Schreiben*
- **REQ-018** (1, offen, Regeln & Nachschlagen) — Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types — *keine `effects[]`; Regeln sind Text mit `{VAR}`*
- **REQ-069** (1, teils, Spielererlebnis) — Phone-first responsive layout for all player-facing views — *Prototyp passt sich an; `apps/web` ist noch klein*
- **REQ-100** (1, teils, Inhaltsgerüst) — Welt als Ebene — *`Layer.kind: world`; keine Mitglieder je Welt*
- **REQ-145** (1, teils, Medien & Assets) — Asset service implementation: app-managed storage (icons, portraits, thumbnails) — *Assets als Artikel; Ablage im Artefakt*
- **REQ-041** (2, teils, Zugang & Betrieb) — Wer was schreiben darf — *Verwaltung oder eigene Figur (+ carries/holds/crafting); die Leitung fehlt in `mayWrite`*
- **REQ-072** (2, offen, Spielererlebnis) — Player notes as owned documents — *`Notes` an Artikeln; kein eigener Notizartikel je Spieler*
- **REQ-079** (2, teils, Kampagne & Sitzungen) — DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap — *Wissen zuteilen im Seitenpanel; kein Ein-Tipp-Knopf in der Sitzung*
- **REQ-092** (2, offen, Regeln & Nachschlagen) — Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) — *keine Art für Zauber — Abgleich A9*
- **REQ-102** (2, teils, Inhaltsgerüst) — Artikel je Stapel und Wissen zeichnen — *Prototyp ja; Server ohne Stapel — Abgleich A2*
- **REQ-113** (2, offen, Live-Spiel) — Widget: notes — *Aufgabe #58*
- **REQ-114** (2, teils, Live-Spiel) — Widget: quick-create (creates entries in the campaign layer inline) — *Anlegen aus dem Board*
- **REQ-146** (2, offen, Medien & Assets) — NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15)
- **REQ-147** (2, teils, Medien & Assets) — Image upload, portraits, icons — *Prototyp ja; Server noch nicht*
- **REQ-166** (2, teils, Oberfläche & Navigation) — Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow — *Anlegen auf dem Board*
- **REQ-202** (2, offen, Spielererlebnis) — Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit
- **REQ-236** (2, offen, Kampagne & Sitzungen) — Kampagne anlegen mit Dialog: Name, aufgeschaltete Ebenen (Liste mit Häkchen und Reihenfolge, vorhandene vorausgewählt), eigene Kampagnenebene, Leitung — *Kampagne anlegen ohne Dialog*
- **REQ-249** (2, teils, Inhaltsgerüst) — Ebenen nach Herausgeber — *`publisherOf` und Herausgeber-Gruppen (T-094, T-109); Kategorien wie die Blocklist von 5e.tools offen*
- **REQ-258** (2, teils, Inhaltsgerüst) — Verweisfeld nennt, welche Artikel es annimmt — *`PropertySchema.target`, `link_wrong_type`; Vorschläge in den Sichtbarkeitsfeldern für jede Art noch nicht überall*
- **REQ-264** (2, teils, Inhaltsgerüst) — Vergleichsebenen der Kampagne — *Vergleichsebenen an der Kampagne; Wahl im Kampagnen-Popup und gruppenweise offen*
- **REQ-269** (2, teils, Zugang & Betrieb) — Ankündigen, wann produktiv gearbeitet werden kann — *Freigabe für verlierende Migrationen steht; Zusage und Ankündigung fehlen*
- **REQ-270** (2, teils, Zugang & Betrieb) — Artikel von dev nach prod übernehmen — *Übernahme (T-130)*
- **REQ-275** (2, teils, Spielererlebnis) — Erhaltene Gegenstände als Instanz — *`instanceOf` am Item vorhanden (T-150 läuft)*
- **REQ-279** (2, teils, Kampagne & Sitzungen) — Kampagnenwerte pflegen und in Texten nutzen — *Auflösung steht; Maske fehlt*
- **REQ-282** (2, offen, Kampagne & Sitzungen) — Sitzungsansicht für das Spiel — *Vorbereitungsseite steht (REQ-078), Spielansicht nicht*
- **REQ-287** (2, offen, Regeln & Nachschlagen) — Regelsysteme als Behälter mit Optionen — *E-044, T-132*
- **REQ-292** (2, teils, Live-Spiel) — Neuen Artikel aus einer Auswahl anlegen
- **REQ-305** (2, offen, Oberfläche & Navigation) — Kampagne und Ebene immer sichtbar — *T-143 läuft*
- **REQ-311** (2, teils, Spielererlebnis) — Spieleransicht mit der eigenen Figur im Fokus — *Entwurf Player/PlayerPhone*
- **REQ-312** (2, teils, Karten) — Eigenes Token bewegen — *Prototyp ja; in der Seite noch nicht für Spielende*
- **REQ-313** (2, teils, Regeln & Nachschlagen) — Zustände als Artikel — *Wirkung `affects` gespeichert, nicht ausgewertet*
- **REQ-007** (3, offen, Inhaltsgerüst) — Stapel für Fortgeschrittene
- **REQ-022** (3, offen, Medien & Assets) — Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side
- **REQ-025** (3, offen, Welt & Lore) — CalendarSystem definition: months, eras, moons, configurable per world/system — *nur die Einstellung `calendar`; keine Kalenderzeile*
- **REQ-028** (3, teils, Oberfläche & Navigation) — Full-text search across content — *Suche am Server über Name, Alias, Deckname und Nummer, Feldfilter als Facetten (`GET /api/list`, W7); keine Volltextsuche*
- **REQ-045** (3, offen, Inhaltsgerüst) — Ebenen-Aktionen am Artikel
- **REQ-055** (3, offen, Kreaturen & Figuren) — Inline trait reuse & variant creation while typing — *Pool steht; Variante beim Tippen nicht*
- **REQ-060** (3, teils, Kreaturen & Figuren) — Companions / summons as regular creatures via companionOf + overrides — *`Creature.kind` companion/summon; keine `companionOf`-Kante*
- **REQ-067** (3, offen, Kreaturen & Figuren) — Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) — *es gibt keine Art für Zauber — Abgleich A9*
- **REQ-074** (3, teils, Spielererlebnis) — Quicklinks: campaign, quests, party, session — *Bereich Play und die Leiste*
- **REQ-080** (3, offen, Kampagne & Sitzungen) — Readaloud blocks unlocking for players after session (time/event-based grant)
- **REQ-083** (3, offen, Spielererlebnis) — Player-created quests and personal goals — *Spieler schreiben nur ihre Figur*
- **REQ-086** (3, teils, Kampagne & Sitzungen) — Party view: passive perception, feats, inventory overview — *Party-Seite mit Inventar und Werkbank; keine Übersicht der passiven Wahrnehmung*
- **REQ-088** (3, teils, Zugang & Betrieb) — Massenänderungen an Wissen und Rechten — *Massenbearbeitung ohne Wissen*
- **REQ-097** (3, offen, Regeln & Nachschlagen) — Spell lists as relations (class ↔ spell) — *braucht REQ-092*
- **REQ-109** (3, teils, Spielererlebnis) — Player-authored ContentBlocks with per-view block-type whitelist — *Felder da (`Article.poem/song`); Schreibrecht offen (REQ-041)*
- **REQ-119** (3, offen, Oberfläche & Navigation) — Player boards
- **REQ-120** (3, teils, Live-Spiel) — Play log: persist state events (actor, target, delta) — *Würfe im Protokoll; Zustandsereignisse nicht gespeichert*
- **REQ-123** (3, offen, Live-Spiel) — Widget: timers
- **REQ-128** (3, teils, Live-Spiel) — Combat player view: own initiative, conditions, health comments — *dieselbe Ansicht, gesiebt*
- **REQ-132** (3, offen, Karten) — Level lock: pin current map level while zooming
- **REQ-135** (3, teils, Karten) — Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) — *Tokens als Kanten; keine getrennte Lebensdauer je Sitzung*
- **REQ-160** (3, teils, Oberfläche & Navigation) — Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board
- **REQ-167** (3, offen, Medien & Assets) — Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config
- **REQ-176** (3, teils, Inhaltsgerüst) — Ähnliches vor dem Anlegen vorschlagen — *Vorschläge nach Name und Alias; keine Ähnlichkeit*
- **REQ-180** (3, offen, Kampagne & Sitzungen) — Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in — *keine Art und kein Feld für gepflanzte Fäden*
- **REQ-187** (3, offen, Live-Spiel) — Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts
- **REQ-200** (3, offen, Spielererlebnis) — Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung
- **REQ-201** (3, offen, Spielererlebnis) — Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle
- **REQ-204** (3, offen, Live-Spiel) — Spielleiter-Schirm je Kampagne: Fenster (mehrere Bildschirme als Browser-Reiter), darin Plätze, die ein Board oder ein Werkzeug zeigen; zuklappbar, umstellbar, zwischen Fenstern verschiebbar
- **REQ-205** (3, teils, Live-Spiel) — Ein Board je Geschichtsartikel (Kampagne, Kapitel, Sitzung, nicht Szene) und Regel-Boards; der Schirm schaltet zwischen ihnen, die Artikelansicht filtert nach Artikeln aus den offenen Boards — *ein Board je Geschichtsartikel über `partOf`, Liste und Anlegen in der Seite (W4, D63); offen: Umschalten auf dem Schirm, Filter nach Artikeln aus offenen Boards*
- **REQ-208** (3, teils, Karten) — Zonen mit eigenen Regeln: eine Zonenart ist ein Regelartikel; Bewegungskosten, Licht, Sicht und „versteckt bis passive Wahrnehmung n“ rechnet die Karte, Schaden, Rettungswurf, Zustand und freie Regeln zeigt sie und schreibt sie beim Betreten ins Protokoll — *`ZoneKind` (Regelartikel) + Kante `zone`: Kosten, Licht und Verdeckung in Weg und Sicht, versteckt bis PP n; Schaden/Rettungswurf/Zustand gezeigt und beim Betreten in `Session.log`. Offen: Auslöser zu Zugbeginn/-ende, Zonenlicht in der Dunkelheitsmaske (D56)*
- **REQ-210** (3, teils, Karten) — Karte und Initiative je als Vollbild, je mit SL- und Spieleransicht; Spielende bewegen ihre eigenen Tokens und prüfen die Reichweite selbst — *Prototyp: Vollbild für Karte und Initiative, SL-/Spieleransicht der Karte, Spielende bewegen eigene Tokens; offen: `redactEntity` hält versteckte Marker am Server nicht zurück (D56)*
- **REQ-221** (3, offen, Kampagne & Sitzungen) — Begegnungsbau: Schwierigkeit aus den XP-Schwellen der Gruppe mit Multiplikator nach Anzahl (2014), Kreaturen aus dem Kompendium, dann auf die Karte setzen und Initiative starten
- **REQ-227** (3, offen, Regeln & Nachschlagen) — Masse im Fliesstext umrechnen: Fuss und Meilen in Regeltexten („within 120 feet“) nach der Einstellung `units` zeigen, beim Lesen gerechnet, gespeichert bleibt der Wortlaut — *umgerechnet werden nur Felder mit `unit` und Angriffszeilen (`convertText`, W2)*
- **REQ-229** (3, offen, Zugang & Betrieb) — Konten in der Seite verwalten — *nur über `user` auf dem Server; die Kontoliste der Verwaltung steht in der Seite (W3)*
- **REQ-242** (3, offen, Zugang & Betrieb) — Felder der eigenen Figur sperren — *die eigene Figur verwaltet der Spieler ganz (E-014 d)*
- **REQ-253** (3, offen, Inhaltsgerüst) — Ebenen und Artikel kopieren — *später; Kopie ohne `overrides`*
- **REQ-268** (3, teils, Zugang & Betrieb) — Dev-Token aus der Werkbank erzeugen — *Tokens am Konto in `konto/`; aus der Werkbank für andere Konten nicht*
- **REQ-271** (3, offen, Zugang & Betrieb) — Konflikte bei der Übernahme nebeneinander lösen — *Konflikte werden heute nur gemeldet*
- **REQ-274** (3, offen, Kreaturen & Figuren) — Charakter- und Kampagnenmanager jederzeit aufrufen
- **REQ-283** (3, offen, Kampagne & Sitzungen) — Kampagnen-Ladebildschirm
- **REQ-285** (3, teils, Welt & Lore) — Fraktionspreise — *`discount` nach Rang, `controls`*
- **REQ-288** (3, teils, Import & Inhalte) — Preise für jeden Gegenstand — *T-139 (`priceNote`) läuft*
- **REQ-289** (3, offen, Regeln & Nachschlagen) — Homebrew-Regeln erfassen — *wenn das Gerüst steht*
- **REQ-291** (3, offen, Oberfläche & Navigation) — Leseansicht auf dem Board
- **REQ-294** (3, teils, Karten) — Token ohne Bild zeigt den Anfangsbuchstaben — *Anfangsbuchstabe ja; Deckname nicht geprüft*
- **REQ-295** (3, offen, Medien & Assets) — Bild ersetzen als Fassung oder neue Quelle
- **REQ-296** (3, teils, Medien & Assets) — Bildklassen — *`Asset.kind` (T-119); Übersicht fehlt*
- **REQ-297** (3, offen, Medien & Assets) — Bilder aus 5e.tools einlesen und verknüpfen
- **REQ-299** (3, teils, Oberfläche & Navigation) — Optionale Felder verdeckt
- **REQ-300** (3, teils, Oberfläche & Navigation) — Gestaltung wie die Bücher — *Pergament in `apps/web`; Design-Lauf offen*
- **REQ-308** (3, offen, Import & Inhalte) — Obsidian-Vault einlesen — *die alten Importer sind weg (2026-09-20)*
- **REQ-314** (3, teils, Import & Inhalte) — Regelwerk eines Drittverlags laden — *T-122*

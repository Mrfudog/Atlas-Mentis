---
tags: [vtt, requirements, view, umsetzung]
status: derived
updated: 2026-10-21
source: ../docs/Anforderungen.md
---

> [!info] Erzeugt aus den Story-Notizen
> `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md` im Repo schreibt diese Notiz neu.
> Wer einen Stand anders sieht, ändert ihn in der Story-Notiz (`VTT/Stories/REQ-nnn.md`).

# Anforderungen — was gefordert war und was steht

Stand 2026-10-21. Jede Story aus dem Vault (`VTT/Stories/`, gegliedert in Epics und Features), mit dem Stand im Repo.
Erzeugt von `packages/registry/scripts/anforderungen.mjs`; der Stand ist ein Urteil und steht in der Story-Notiz
(`stand`, `standNotiz`) — wer ihn anders sieht, ändert die Notiz und lässt das Skript laufen.

| Stand | Heisst |
|---|---|
| **steht** | gebaut, in der Form der Anforderung oder einer gleichwertigen |
| **teils** | ein Teil steht; was fehlt, steht in der Anmerkung |
| **offen** | nichts davon steht |
| **ersetzt** | anders gelöst als gefordert, mit Absicht — die Anmerkung sagt wie |
| **verworfen** | entschieden gegen die Anforderung |

Zusammen: 184 steht · 54 teils · 105 offen · 10 ersetzt · 6 verworfen — 359 Stories in 80 Features und 12 Epics.

| Epic | Stories | Stand |
|---|---|---|
| [EP-01 Inhaltsgerüst](#ep-01-inhaltsgerüst) | 53 | 33 steht · 10 teils · 4 offen · 4 ersetzt · 2 verworfen |
| [EP-02 Zugang & Betrieb](#ep-02-zugang--betrieb) | 44 | 28 steht · 5 teils · 8 offen · 1 ersetzt · 2 verworfen |
| [EP-03 Kreaturen & Figuren](#ep-03-kreaturen--figuren) | 29 | 18 steht · 2 teils · 8 offen · 1 ersetzt |
| [EP-04 Spielererlebnis](#ep-04-spielererlebnis) | 42 | 7 steht · 9 teils · 26 offen |
| [EP-05 Kampagne & Sitzungen](#ep-05-kampagne--sitzungen) | 31 | 17 steht · 3 teils · 11 offen |
| [EP-06 Welt & Lore](#ep-06-welt--lore) | 17 | 8 steht · 1 teils · 6 offen · 2 ersetzt |
| [EP-07 Regeln & Nachschlagen](#ep-07-regeln--nachschlagen) | 27 | 13 steht · 2 teils · 12 offen |
| [EP-08 Live-Spiel](#ep-08-live-spiel) | 28 | 14 steht · 6 teils · 7 offen · 1 ersetzt |
| [EP-09 Karten](#ep-09-karten) | 28 | 18 steht · 6 teils · 4 offen |
| [EP-10 Medien & Assets](#ep-10-medien--assets) | 21 | 4 steht · 3 teils · 14 offen |
| [EP-11 Oberfläche & Navigation](#ep-11-oberfläche--navigation) | 29 | 19 steht · 5 teils · 4 offen · 1 ersetzt |
| [EP-12 Import & Inhalte](#ep-12-import--inhalte) | 10 | 5 steht · 2 teils · 1 offen · 2 verworfen |

## EP-01 Inhaltsgerüst

Register, Arten, Felder, Kanten, Ebenen und Fassungen, Ansichten — das Modell, mit dem jeder Artikel beschrieben, gespeichert und gezeichnet wird.

**Arten:** [Layer](../docs/Artikeltypen.md#layer), `Identity`, `Status`, `Visibility`, `Tags`, `Source`

**Kanten:** `inLayer`, `activates`, `partOf`, `overrides`, `variantOf`, `instanceOf`

**Code:** `packages/model/src/validate.ts`, `packages/model/src/entity.ts`, `packages/model/src/stack.ts`, `packages/model/src/views.ts`, `packages/model/src/inline.ts`, `packages/model/src/versions.ts`, `packages/registry/src`, `apps/web/src/app/register`

**Erklärt in:** [Datenmodell.md](../docs/Datenmodell.md), [Begriffe.md](../docs/Begriffe.md), [Ebenen.md](../docs/Ebenen.md), [Artikeltypen.md](../docs/Artikeltypen.md), [Durchgang.md](../docs/Durchgang.md)

**Offen mit Prio 1–3:** REQ-003 Änderungsverlauf je Artikel (teils) · REQ-006 Stapel: was in der Kampagne gilt (teils) · REQ-007 Stapel für Fortgeschrittene (offen) · REQ-008 Varianten einer Sache (teils) · REQ-013 Verweise nach Nummer, getippt nach Name (teils) · REQ-045 Ebenen-Aktionen am Artikel (offen) · REQ-100 Welt als Ebene (teils) · REQ-102 Artikel je Stapel und Wissen zeichnen (teils) · REQ-176 Ähnliches vor dem Anlegen vorschlagen (teils) · REQ-249 Ebenen nach Herausgeber (teils) · REQ-253 Ebenen und Artikel kopieren (offen) · REQ-258 Verweisfeld nennt, welche Artikel es annimmt (teils) · REQ-264 Vergleichsebenen der Kampagne (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-001 Artikelmodell

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-001]] | Artikel aus Arten, Feldern und Kanten | 1 | **steht** | Peg, Karten, Kanten, Register — Datenmodell.md §1–5 |
| [[REQ-002]] | Nachfolgerkette | 1 | **ersetzt** | keine Nachfolgerkette; Fassungen über `overrides` und `variantOf` in Ebenen |
| [[REQ-010]] | Feldgruppen nur, wo sie gebraucht werden | 1 | **steht** | als Grundtypen: `Visibility`, `Status`, `Time` |
| [[REQ-011]] | Inhaltsblock als eigenes Grundelement | 1 | **ersetzt** | ein Textblock ist ein Feld (`many` + `long`) mit Eintrags-Id; gesperrt wird je Eintrag über eine Information |
| [[REQ-016]] | Übersetzungsschicht für Begriffe | 1 | **verworfen** | keine Übersetzungsschicht; Bezeichner englisch, Inhalte in der Sprache der Kampagne |
| [[REQ-019]] | Rohform jedes Imports aufbewahren | 1 | **verworfen** | die Importer sind weg (2026-09-20), mit ihnen `Imported`; kommt mit neuen Importern zurück |
| [[REQ-163]] | Bezeichner ohne Bedeutung | 1 | **steht** | undurchsichtige Id; `Identity.id` als Nummer |
| [[REQ-181]] | Freie Felder an einem einzelnen Artikel | 2 | **steht** | `adhoc` mit Befördern |
| [[REQ-182]] | Kanten lesen sich von beiden Enden | 2 | **steht** | `inverseLabel` |

### F-002 Register

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-027]] | Arten ohne Code anlegen | 4 | **steht** | das Register ist Daten mit Masken (Prototyp, Registerseite in der Web-Oberfläche: REQ-230); keine Codeänderung je Art |
| [[REQ-230]] | Register in der Seite bearbeiten | 2 | **steht** | Registerseite `/registry` mit Zählung (`registryUsage`, `GET /api/registry/usage`); schreiben Verwaltung und `gm` der laufenden Kampagne (W5, D64) |
| [[REQ-260]] | Ausgehende Kanten im Register sehen | 3 | **steht** | Gruppe „Edges from here“ im Register |
| [[REQ-262]] | Flache Typenlisten | 3 | **steht** | `typeList()` |
| [[REQ-263]] | Was eine Einstellung im Register auslöst | 3 | **steht** | Erklärzeilen im Register |
| [[REQ-265]] | Register zeigt einen Typ auf einer Fläche | 2 | **steht** | Registerfläche, `UI.regOpen` |

### F-003 Feldformen & Aufzählungen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-012]] | Textfelder für jede Art von Text | 2 | **steht** | als Prosafelder: paragraph, readaloud, fact, secret, lore, tactics, note, poem, song, appearance, personality |
| [[REQ-023]] | Status idea/planned/used/discarded | 2 | **ersetzt** | `State`: idea · prepared · ready; used/discarded waren Ereignisse und sind das Feld der Art (`Quest.progress`, `Encounter.phase`) |
| [[REQ-258]] | Verweisfeld nennt, welche Artikel es annimmt | 2 | **teils** | `PropertySchema.target`, `link_wrong_type`; Vorschläge in den Sichtbarkeitsfeldern für jede Art noch nicht überall |
| [[REQ-259]] | Vorgabewerte für Felder | 3 | **steht** | `default` am Feld |
| [[REQ-261]] | Sorte einer Art als freies Feld mit Vorschlägen | 2 | **steht** | `Creature.kind`, `Place.kind`, `suggest` |

### F-004 Ebenen & Stapel

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-004]] | Ebenen als Pakete von Inhalt | 1 | **steht** | `Layer.kind` system · expansion · world · pack · campaign · overrides, `order`, `version` |
| [[REQ-005]] | Zugehörigkeit eines Artikels zu einer Ebene | 1 | **steht** | `inLayer` mit `mode` adds/removes; Überschreiben ist die Kante `overrides`; kein Pin |
| [[REQ-006]] | Stapel: was in der Kampagne gilt | 1 | **teils** | Prototyp: `inStack`/`resolveArticle`; Server kennt nur die Zugehörigkeit (`campaignsOf`) — Abgleich A2 |
| [[REQ-007]] | Stapel für Fortgeschrittene | 3 | **offen** |  |
| [[REQ-044]] | Herkunft am Artikel sehen | 2 | **steht** | Herkunft am Artikelkopf, Ansicht `stack` |
| [[REQ-045]] | Ebenen-Aktionen am Artikel | 3 | **offen** |  |
| [[REQ-100]] | Welt als Ebene | 1 | **teils** | `Layer.kind: world`; keine Mitglieder je Welt |
| [[REQ-102]] | Artikel je Stapel und Wissen zeichnen | 2 | **teils** | Prototyp ja; Server ohne Stapel — Abgleich A2 |
| [[REQ-244]] | Ebenen gruppieren | 2 | **steht** | `kind: group`, `partOf`, `resolvedStack` (T-088, E-022 b); Gruppe ganz schalten und Häkchen aus dem Stand der Bücher: `groupSwitched` (T-185) |
| [[REQ-245]] | Ebenen beschreiben sich selbst | 2 | **steht** | Titel, Kürzel, Beschreibung an der Ebene (T-088) |
| [[REQ-249]] | Ebenen nach Herausgeber | 2 | **teils** | `publisherOf` und Herausgeber-Gruppen (T-094, T-109); Kategorien wie die Blocklist von 5e.tools offen |
| [[REQ-253]] | Ebenen und Artikel kopieren | 3 | **offen** | später; Kopie ohne `overrides` |
| [[REQ-255]] | Ebenen teilweise aufschalten | 2 | **steht** | `activates` mit Auswahl nach Bereich und Art (T-105) |
| [[REQ-348]] | Ebene am Artikel immer sichtbar | 1 | **steht** | T-251: Ebenen-Marke im Kopf jeder Artikelseite (Ebene, Ebenen der Fassungen, Grund), in der Kurzansicht und knapp in Listenzeilen |

### F-005 Fassungen & Varianten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-008]] | Varianten einer Sache | 1 | **teils** | Kante `variantOf` da; kein Kopierknopf |
| [[REQ-009]] | Überschreiben in der eigenen Ebene | 2 | **steht** | `overrides` in einer Ebene, Auflösung im Prototyp |
| [[REQ-108]] | Lore der Kampagne abweichen lassen | 3 | **steht** | `overrides` in der Kampagnenebene |
| [[REQ-264]] | Vergleichsebenen der Kampagne | 2 | **teils** | Vergleichsebenen an der Kampagne; Wahl im Kampagnen-Popup und gruppenweise offen |
| [[REQ-310]] | Fassungen am Feld zeigen | 2 | **steht** | T-092, T-103 |

### F-006 Ansichten & Anordnung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-026]] | Ansichten festlegen | 1 | **steht** | drei Ansichten, Anordnung am Typ (`InterfaceDef.views`) |
| [[REQ-164]] | Darstellungsstufen als eigenes System | 2 | **ersetzt** | drei Ansichten; Bild, Token, Karte sind Elemente |
| [[REQ-256]] | Ansichten ohne Code definieren | 1 | **steht** | Ansichten im Register, Anpassung je Art (T-110, E-030 b) |

### F-007 Verweise & Platzhalter

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-013]] | Verweise nach Nummer, getippt nach Name | 1 | **teils** | `[[Verweise]]` nach Name und Alias, Vorschläge beim Tippen, `Rule.autolink`; kein Auto-Link beim Schreiben |
| [[REQ-014]] | Rückbezüge sehen | 3 | **steht** | Rückbezüge in der Seitenleiste (`backlinks`) |
| [[REQ-174]] | Regeltexte mit Platzhaltern | 2 | **steht** | `{VAR}`: Kante → Artikel → Kampagnenwerte → Register; ein Platzhalter trägt seinen Artikel, Satzanfang gross beim Lesen (D60) |
| [[REQ-175]] | Regelbegriffe im Text erkennen | 3 | **steht** | `Rule.autolink`, gelesen vom Glossar: `spotTerms`, Glossarleiste (T-242, REQ-341) |
| [[REQ-176]] | Ähnliches vor dem Anlegen vorschlagen | 3 | **teils** | Vorschläge nach Name und Alias; keine Ähnlichkeit |
| [[REQ-341]] | Glossar: Begriffe im Text nachschlagen | 1 | **steht** | `GlossaryTerm`, `explains`, `spotTerms`, Glossarleiste, `GET /api/glossary` (T-242) |

### F-008 Kanten verstehen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-015]] | Graph der Artikel | 4 | **offen** | Typdiagramm steht (Register › How it works); Artikelgraph nicht — Aufgabe #44 |
| [[REQ-257]] | Kanten verständlich | 2 | **steht** | „How edges work“, Erklärung in Auswahl und Register (T-111) |

### F-009 Verlauf & gleichzeitiges Schreiben

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-003]] | Änderungsverlauf je Artikel | 1 | **teils** | Server schreibt `event_log` (`entity.written`, `entity.deleted`); keine Anzeige, keine Kette |
| [[REQ-191]] | Nichts still überschreiben | 1 | **steht** | Fail-closed im Prototyp; in der Seite: Schreiben nur gegen gelesene Revision, Entwurf herunterladbar |
| [[REQ-192]] | Gleichzeitig bearbeiten ohne Verlust | 2 | **steht** | Revision je Artikel am Server (409), Zusammenführen in der Maske (mergeEntity) |

## EP-02 Zugang & Betrieb

Konten, Rollen je Kampagne, Sichtbarkeit und Wissen, Schreibrechte, API-Tokens, Werkbank, Ausrollen, Sicherung, Übernahme zwischen dev und prod, Leistung.

**Arten:** `Visibility`, [Information](../docs/Artikeltypen.md#information), [Knowledge](../docs/Artikeltypen.md#knowledge), [Faction](../docs/Artikeltypen.md#faction), [Party](../docs/Artikeltypen.md#party)

**Kanten:** `knownBy`, `includes`, `memberOf`, `memberOfParty`

**Code:** `apps/server/src/auth.ts`, `apps/server/src/user.ts`, `apps/server/src/ebenenrechte.ts`, `apps/server/src/schreibebene.ts`, `apps/server/src/uebernahme.ts`, `packages/model/src/visibility.ts`, `packages/model/src/knowledge.ts`, `packages/model/src/checks.ts`, `packages/model/src/bulk.ts`, `apps/web/src/app/werkbank`, `apps/web/src/app/konto`

**Erklärt in:** [Zugang.md](../docs/Zugang.md), [Wissen.md](../docs/Wissen.md), [Betrieb.md](../docs/Betrieb.md), [Architektur.md](../docs/Architektur.md)

**Offen mit Prio 1–3:** REQ-041 Wer was schreiben darf (teils) · REQ-088 Massenänderungen an Wissen und Rechten (teils) · REQ-229 Konten in der Seite verwalten (offen) · REQ-242 Felder der eigenen Figur sperren (offen) · REQ-268 Dev-Token aus der Werkbank erzeugen (teils) · REQ-269 Ankündigen, wann produktiv gearbeitet werden kann (teils) · REQ-270 Artikel von dev nach prod übernehmen (teils) · REQ-271 Konflikte bei der Übernahme nebeneinander lösen (offen) · REQ-354 Wissenspunkte bei eigener Herkunft und eigenem Hintergrund (offen)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-010 Anmeldung & Konten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-031]] | Anmelden mit Passwort | 1 | **steht** | Argon2id, Sitzung beim Server (Zugang.md) |
| [[REQ-032]] | Anmeldung über Nextcloud/OIDC | 4 | **verworfen** | Entscheidung 2 (19.9.): kein SSO |
| [[REQ-033]] | Konten | 1 | **steht** | `app_user` |
| [[REQ-034]] | Einladen per Link | 2 | **steht** | Einladung, Konto selbst anlegen |
| [[REQ-228]] | Verlorene Einladung neu ausgeben | 4 | **offen** | heute widerrufen und neu anlegen (W3) |
| [[REQ-229]] | Konten in der Seite verwalten | 3 | **offen** | nur über `user` auf dem Server; die Kontoliste der Verwaltung steht in der Seite (W3) |
| [[REQ-266]] | Demo-Zugang | 5 | **offen** |  |

### F-011 Rollen je Kampagne

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-035]] | Rolle je Kampagne | 1 | **steht** | `campaign_member (campaign, user, role)`; Scope ist die Kampagne |
| [[REQ-036]] | Leitung, Spieler und Verwaltung | 1 | **steht** | gm · co-gm · player · spectator; `is_admin` global |
| [[REQ-037]] | Mitleitung und Zuschauer | 3 | **steht** |  |

### F-012 Sichtbarkeit & Wissen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-038]] | Wer einen Artikel sieht | 1 | **steht** | `audience`, am Server ausgewertet (`articleVisible`) |
| [[REQ-039]] | Sichtbarkeit mit Rollenlisten und Freigabemarken | 3 | **ersetzt** | drei Felder statt sechs; scope, Rollenlisten, sharedUsers weg (30.9.) |
| [[REQ-040]] | Wissen zuteilen | 2 | **steht** | anders: `Information`/`Knowledge` als Artikel, `knownBy` an Träger |
| [[REQ-059]] | Wissen über Arten von Kreaturen | 3 | **steht** | `Facts.fact#id` über eine Information |
| [[REQ-156]] | Sichtbarkeit vererben | 2 | **verworfen** | `inherit` bewusst weg — kommt mit einer Tiefe wieder, wenn gebraucht |
| [[REQ-177]] | Einzelne Felder freigeben | 2 | **steht** | `Information.fields` je Feld und je Eintrag |
| [[REQ-178]] | Decknamen | 3 | **steht** | `Identity.cover` |
| [[REQ-179]] | Zeigen, dass es mehr gibt | 4 | **steht** | „…and 3 more things" |
| [[REQ-203]] | Wissen nach Rang in einer Fraktion | 2 | **steht** | `Faction.ranks`, `memberOf.props.rank`, `knownBy.props.rank` als Mindestrang (7.10., A7) |
| [[REQ-350]] | Eine Information gilt für eine Gruppe von Artikeln | 1 | **steht** | T-285: Information.applies (Typen, Bedingungen auf Felder und Kanten, Kante auf einen Artikel samt Unterarten) |
| [[REQ-351]] | Wissen über Herkunft, Hintergrund, Klasse und Talent | 1 | **steht** | T-285: knownBy auch an Ancestry, Background, Class, Subclass, Feat; die Figur zählt sie zu ihren Trägern |
| [[REQ-352]] | Reiter Knowledge am Artikel | 1 | **steht** | T-286: Kasten Knowledge in der Seitenspalte (Leitung), Routen /api/knowledge/…; neue Information gilt über applies.article |
| [[REQ-353]] | Die Seite eines Wissens zeigt alles, was es vereint | 1 | **steht** | T-287: Element knowledge an der Art Knowledge, GET /api/knowledge/:id/contents (gesiebt) |
| [[REQ-354]] | Wissenspunkte bei eigener Herkunft und eigenem Hintergrund | 2 | **offen** |  |

### F-013 Schreibrechte & Freigabe

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-041]] | Wer was schreiben darf | 2 | **teils** | Verwaltung oder eigene Figur (+ carries/holds/crafting); die Leitung fehlt in `mayWrite` |
| [[REQ-042]] | Schreibrecht je Feldgruppe | 4 | **offen** |  |
| [[REQ-237]] | Spielende legen Artikel an, die Leitung gibt frei | 2 | **steht** | `isReady`, `Viewer.own`, `entity_ready` (T-075, D72, D74) |
| [[REQ-242]] | Felder der eigenen Figur sperren | 3 | **offen** | die eigene Figur verwaltet der Spieler ganz (E-014 d) |
| [[REQ-316]] | Eigene Ebene je Spieler als Vorgabe | 1 | **steht** | T-164: Spielerebene je Konto und Kampagne, Vorgabe zum Anlegen, Übernahme durch die Leitung; Migration 069 |

### F-014 Sicht eines Spielers

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-241]] | Die Sicht eines Spielers einnehmen | 1 | **steht** | Sicht eines Kontos am Server gerechnet (E-019 a) |

### F-015 API-Tokens & Werkzeugzugang

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-234]] | API-Tokens für Werkzeuge | 3 | **steht** | `app_token`, Bearer `atm_…`, `read`/`write` mit Ablauf; `scripts/atlas.mjs` (W9) |
| [[REQ-268]] | Dev-Token aus der Werkbank erzeugen | 3 | **teils** | Tokens am Konto in `konto/`; aus der Werkbank für andere Konten nicht |

### F-016 Werkbank

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-088]] | Massenänderungen an Wissen und Rechten | 3 | **teils** | Massenbearbeitung ohne Wissen |
| [[REQ-235]] | Werkbank: Prüfungen und Massenänderungen | 3 | **steht** | `/werkbank`: Prüfungen (`CHECKS`), `POST /api/bulk` mit Vorschau, `event_log` und Rückgängig (W9, D68) |

### F-017 Ausrollen & Sicherung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-154]] | Ausrollen nach dev und prod | 1 | **steht** | Hetzner, Caddy, GHCR (Betrieb.md) |
| [[REQ-155]] | Sicherungen | 2 | **steht** | Sicherung vor jedem Ausrollen; nächtliche als Rezept |
| [[REQ-199]] | Produktionsdaten nach dev spiegeln | 3 | **steht** | Rezept in Betrieb.md, ohne Konten; `members` nicht in der Ausfuhr |
| [[REQ-267]] | Eigenes Netz-VPS mit VPN | 5 | **offen** | bewusst später |
| [[REQ-269]] | Ankündigen, wann produktiv gearbeitet werden kann | 2 | **teils** | Freigabe für verlierende Migrationen steht; Zusage und Ankündigung fehlen |

### F-018 Übernahme dev ↔ prod

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-270]] | Artikel von dev nach prod übernehmen | 2 | **teils** | Übernahme (T-130) |
| [[REQ-271]] | Konflikte bei der Übernahme nebeneinander lösen | 3 | **offen** | Konflikte werden heute nur gemeldet |

### F-019 Leistung & Laden

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-232]] | Listen rechnet der Server | 2 | **steht** | `GET /api/list` mit Spalten aus `overview` und Facetten, 2 KB je Blatt in 15–40 ms; erster Aufruf eines Spielers nach einer Änderung ≈370 ms (W7, D66) |
| [[REQ-246]] | Navigation ohne Einfrieren | 1 | **steht** | Stapel einmal gerechnet, Ladebanner, Startmeldung (T-086) |

### F-080 Qualität & Tests

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-359]] | Jede Änderung im Browser geprüft | 1 | **steht** | Gerüst, CI-Job e2e und die Specs Anmelden, Artikel, Kompendium, Karte, Initiative, Board, Charakter bis Stufe 2 und Kampagnenboard (T-356). Pflichtprüfung trägt die Leitung ein. |

## EP-03 Kreaturen & Figuren

Kreatur, Statblock (Vorlage und Instanz), Charakterbogen und Charaktermanager — alles, was eine Figur oder ein Monster beschreibt.

**Arten:** [Creature](../docs/Artikeltypen.md#creature), `PlayerCharacter`, [Statblock](../docs/Artikeltypen.md#statblock), `Abilities`, `Proficiencies`, `Vitals`, [Class](../docs/Artikeltypen.md#class), [Subclass](../docs/Artikeltypen.md#subclass), [Ancestry](../docs/Artikeltypen.md#ancestry), [Background](../docs/Artikeltypen.md#background), [Feature](../docs/Artikeltypen.md#feature), [Feat](../docs/Artikeltypen.md#feat)

**Kanten:** `belongsTo`, `instanceOf`, `hasClass`, `hasAncestry`, `hasBackground`, `grants`, `chose`, `subclassOf`

**Code:** `packages/model/src/abilities.ts`, `packages/model/src/builder.ts`, `packages/model/src/classes.ts`, `packages/model/src/instance.ts`, `packages/model/src/choices.ts`, `apps/web/src/app/artikel/statblock.ts`, `apps/web/src/app/figur`, `apps/web/src/app/klassen`

**Erklärt in:** [Datenmodell.md](../docs/Datenmodell.md), [Begriffe.md](../docs/Begriffe.md)

**Offen mit Prio 1–3:** REQ-055 Merkmale beim Tippen wiederverwenden (offen) · REQ-060 Begleiter und Beschwörungen (teils) · REQ-274 Charakter- und Kampagnenmanager jederzeit aufrufen (offen) · REQ-344 Gesperrte Aktionen bleiben sichtbar, mit Grund (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-020 Kreatur

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-046]] | Kreatur und Statblock getrennt | 1 | **steht** | `belongsTo`, `PlayerCharacter`; NPC ist `Creature.kind` |
| [[REQ-050]] | Kreatur auf einen Blick | 2 | **steht** | Reiter Overview · Combat · Gear · Craft · Ties |
| [[REQ-060]] | Begleiter und Beschwörungen | 3 | **teils** | `Creature.kind` companion/summon; keine `companionOf`-Kante |
| [[REQ-105]] | NSC-Verzeichnis | 3 | **steht** | Kompendium nach Art gefiltert |

### F-021 Statblock

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-052]] | Statblock lesen wie im Buch | 3 | **steht** | Statblock-Seite mit eingesetzten Regeln |
| [[REQ-053]] | Statblock aus Regeln zusammensetzen | 2 | **steht** | `composedOf` mit `{VAR}`-Bindung |
| [[REQ-054]] | Kampfrolle am Statblock | 2 | **steht** | `Statblock.combatRole` |
| [[REQ-055]] | Merkmale beim Tippen wiederverwenden | 3 | **offen** | Pool steht; Variante beim Tippen nicht |
| [[REQ-058]] | Monster skalieren | 5 | **offen** |  |
| [[REQ-062]] | Statblöcke anderer Regelsysteme | 5 | **offen** | `Statblock.system` als Feld vorhanden |
| [[REQ-272]] | Statblock als Instanz einer Vorlage | 1 | **steht** | `instanceOf`, `resolveInstance`, `thinInstance` |

### F-022 Schnellanlage

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-048]] | Kreatur schnell bearbeiten | 2 | **steht** | Bearbeiten in der Ansicht und im Dialog |
| [[REQ-049]] | Kreatur schnell anlegen | 2 | **steht** | Anlegedialog mit Statblock-Frage, Schnellanlage aus einem Verweis |

### F-023 Charakterbogen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-051]] | Schnelle Änderungen am Bogen | 2 | **steht** | `Vitals` mit `alwaysEdit`, Bogen |
| [[REQ-063]] | Charakterbogen: Allgemein | 2 | **steht** | Kopf der Spielerseite (T-247): HP mit Betrag, Trefferwürfel, Plätze, Inspiration, Zustände mit Dauer; Rast folgt mit T-241 |
| [[REQ-066]] | Charakterbogen: Kampf | 3 | **steht** | Reiter Combat mit „Your turn“ nach Aktionsart, Sperren mit Grund (T-247); Initiative am Spieltisch |
| [[REQ-067]] | Charakterbogen: Zauber | 3 | **steht** | Reiter Spells (T-246): Zauberkopf, Zauber nach Grad, Cast mit Platz und Konzentration, Listen, Lernweg |
| [[REQ-068]] | Charakterbogen: Freispiel | 4 | **offen** |  |
| [[REQ-073]] | Eigene Anordnung des Bogens je Nutzer | 4 | **ersetzt** | die Anordnung steht am Typ im Register, nicht je Nutzer |
| [[REQ-343]] | Konzentration und Zustandsdauer in der Statuszeile | 1 | **steht** | Statuszeile im Kopf, `Vitals.concentration`/`durations` (T-247) |
| [[REQ-344]] | Gesperrte Aktionen bleiben sichtbar, mit Grund | 1 | **teils** | „Your turn“ und Spells sperren nach den Händen (T-247, T-246); das Ausrüsten selbst wartet auf T-244 |

### F-024 Charaktermanager

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-056]] | Kreaturen-Baukasten | 4 | **offen** |  |
| [[REQ-057]] | Punktekauf für Attribute | 4 | **offen** |  |
| [[REQ-222]] | Stufenaufstieg mit Wahlen | 4 | **offen** |  |
| [[REQ-238]] | Figur aus den Artikeln erstellen | 1 | **steht** | Assistent für Figuren aus den Artikeln (T-080, E-015 a); Aufstieg mit Wahlen: REQ-222 |
| [[REQ-250]] | Startausrüstung je Kampagne | 2 | **steht** | Startausrüstung nach Kampagnenregel (T-096) |
| [[REQ-251]] | Sprachen der Kampagne | 1 | **steht** | `Campaign.languages` (T-095) |
| [[REQ-273]] | Eigene Verfahren für Attributswerte | 2 | **steht** | E-016 |
| [[REQ-274]] | Charakter- und Kampagnenmanager jederzeit aufrufen | 3 | **offen** |  |

## EP-04 Spielererlebnis

Was Spielende sehen und tun: Spieleransicht und Telefon, eigene Figur und eigene Inhalte, Inventar, Chat.

**Arten:** [Inventory](../docs/Artikeltypen.md#inventory), [Item](../docs/Artikeltypen.md#item), `PlayerCharacter`

**Kanten:** `carries`, `holds`, `leftBehind`

**Code:** `packages/model/src/inventory.ts`, `packages/model/src/slots.ts`, `packages/model/src/stowing.ts`, `apps/web/src/app/artikel/inventar.ts`, `apps/server/src/stueck.ts`, `apps/server/src/spielerebene.ts`, `apps/web/src/app/kern/spieler.ts`

**Erklärt in:** [Zugang.md](../docs/Zugang.md), [Spieltisch.md](../docs/Spieltisch.md)

**Offen mit Prio 1–3:** REQ-069 Am Telefon spielen (teils) · REQ-072 Eigene Notizen (offen) · REQ-074 Schnellzugriffe (teils) · REQ-083 Eigene Quests und Ziele (offen) · REQ-109 Lore-Texte von Spielenden (teils) · REQ-200 Chat mit der Leitung und unter Spielenden (offen) · REQ-201 Aus dem Chat wird Inhalt (offen) · REQ-202 Chats bleiben privat (offen) · REQ-215 Tragraster aus Grösse und Stärke (teils) · REQ-216 Behälter in Behältern (teils) · REQ-225 Fallenlassen und Verstauen (teils) · REQ-275 Erhaltene Gegenstände als Instanz (teils) · REQ-311 Spieleransicht mit der eigenen Figur im Fokus (teils) · REQ-320 Formen frei malen, auch nicht rechteckig (offen) · REQ-321 Stapel im Raster (offen) · REQ-322 Besondere Zonen mit eigenen Regeln (offen) · REQ-323 Alle möglichen Plätze eines Gegenstands (offen) · REQ-324 Hände als Plätze mit Regeln (offen) · REQ-325 Gegenstandsartikel im Detailbereich (offen) · REQ-326 Ziehen und Ablegen im Raster (offen) · REQ-327 Packen am Telefon (offen) · REQ-328 Ablage für nicht Verstautes (offen) · REQ-332 Beute öffnen und nehmen (offen) · REQ-333 Vorgaben für Formen und Stapel (offen) · REQ-334 Tragende Ausrüstung als Behälter mit eigenem Raster (offen) · REQ-335 Verbund: Zellen, die gemeinsam ein Stück tragen (offen) · REQ-336 Festlegen, wo ein Gegenstand getragen werden darf (offen) · REQ-337 Sehen, was weichen muss (offen) · REQ-338 Körperplätze als Plan des Moduls (offen) · REQ-339 Tragende Ausrüstung an der Figur (offen) · REQ-340 Raster und Zonen eines Trägers in der Maske (offen) · REQ-346 Was die Kampagne meiner Figur gezeigt hat (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-025 Spieleransicht & Telefon

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-069]] | Am Telefon spielen | 1 | **teils** | Spielerseite bei 390 px ohne Überlauf, Kopf eingeklappt (T-247); Inventar am Telefon wartet auf T-244 |
| [[REQ-074]] | Schnellzugriffe | 3 | **teils** | Bereich Play und die Leiste |
| [[REQ-194]] | Untere Leiste am Telefon wählen | 4 | **offen** |  |
| [[REQ-311]] | Spieleransicht mit der eigenen Figur im Fokus | 2 | **teils** | Entwurf Player/PlayerPhone |
| [[REQ-346]] | Was die Kampagne meiner Figur gezeigt hat | 1 | **teils** | Reiter Campaign an der Spielerfigur (T-247); „als Spieler sehen“ für die Leitung offen |

### F-026 Inventar

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-064]] | Inventar als Liste | 2 | **steht** | `holds.tier`, `holds.slot` |
| [[REQ-065]] | Inventar als Raster | 4 | **steht** | Kachelraster, `Item.rows`, `Inventory.grid`/`zones` |
| [[REQ-183]] | Gruppeninventar | 3 | **steht** | `carries` von `Party` |
| [[REQ-214]] | Ausrüstungsfigur | 4 | **steht** | `Creature.figure`, Plätze des Blatts an `holds.props.slot`, Reiter „Worn“ mit Figur (Prototyp, D54) |
| [[REQ-215]] | Tragraster aus Grösse und Stärke | 3 | **teils** | `Statblock.carryExtra` gerechnet, Grundquadrat aus `carrySquares`; `carryGrid` im Modell, Prototyp (D54). Zonen je Zelle setzbar („Shape & zones“); die Vorgabe nach Spalten kommt noch aus der globalen Einstellung `carryZones`, nicht aus dem Inventarmodul (E-096) |
| [[REQ-216]] | Behälter in Behältern | 3 | **teils** | Ziehstufe die Kette hinauf (`drawStage`), `slotDraw`, Basiszonen `carryZones` und Vorlagen `container:*` (D54). Offen nach E-096: innere Zonen zählen heute absolut (das Langsamere aus Zone und Behälter + 1), nicht vom Platz des Behälters aus |
| [[REQ-217]] | Ziehen am Bogen | 3 | **steht** | Abschnitt „Actions“ am Bogen, je `DrawTime`-Stufe „Draw“ mit Weg (Prototyp, D54); die Kosten rechnet `drawStage` (relativ nach E-096 mit REQ-216) |
| [[REQ-225]] | Fallenlassen und Verstauen | 3 | **teils** | „Drop“/„Stow“ am Bogen in der Zeile ihrer Kosten (Einstellung `handActions`), `tier: ground`, Gurt frei in `slotDraw`; `handActions`/`inHand` im Modell (Prototyp, D58). Offen nach E-080 a: Kosten aus dem Modul (`fixed`/`drawPlusOne`), am Platz und im Verdrängen-Dialog |
| [[REQ-275]] | Erhaltene Gegenstände als Instanz | 2 | **teils** | `instanceOf` am Item vorhanden (T-150 läuft) |
| [[REQ-276]] | Unverstaute Gegenstände gelten als liegengelassen | 4 | **offen** |  |
| [[REQ-277]] | Gegenstände mit Form spiegeln | 4 | **offen** |  |
| [[REQ-320]] | Formen frei malen, auch nicht rechteckig | 2 | **offen** |  |
| [[REQ-321]] | Stapel im Raster | 2 | **offen** |  |
| [[REQ-322]] | Besondere Zonen mit eigenen Regeln | 2 | **offen** |  |
| [[REQ-323]] | Alle möglichen Plätze eines Gegenstands | 2 | **offen** |  |
| [[REQ-324]] | Hände als Plätze mit Regeln | 2 | **offen** |  |
| [[REQ-325]] | Gegenstandsartikel im Detailbereich | 2 | **offen** |  |
| [[REQ-326]] | Ziehen und Ablegen im Raster | 2 | **offen** |  |
| [[REQ-327]] | Packen am Telefon | 2 | **offen** |  |
| [[REQ-328]] | Ablage für nicht Verstautes | 2 | **offen** |  |
| [[REQ-333]] | Vorgaben für Formen und Stapel | 2 | **offen** |  |
| [[REQ-355]] | Tragraster, Zonen und Behälter einstellen | 2 | **steht** | Rules & options › Inventory: Grössen, Zonen je Spalte, Behältervorlagen gemalt, Fallenlassen/Verstauen, Körperplätze (T-291). |
| [[REQ-356]] | Tragblatt aus Bausteinen mit Zonen und Bedingungen | 2 | **steht** | Einstellung carrySheet: Bausteine mit Form, Zonen und Bedingungen, aneinandergefügt (assembleCarry); Editor mit Vorschau für Grösse und STR, Zonenmaler auch für Behältervorlagen (T-298). |

### F-027 Eigene Inhalte der Spielenden

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-072]] | Eigene Notizen | 2 | **offen** | `Notes` an Artikeln; kein eigener Notizartikel je Spieler |
| [[REQ-083]] | Eigene Quests und Ziele | 3 | **offen** | Spieler schreiben nur ihre Figur |
| [[REQ-109]] | Lore-Texte von Spielenden | 3 | **teils** | Felder da (`Article.poem/song`); Schreibrecht offen (REQ-041) |

### F-028 Chat

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-200]] | Chat mit der Leitung und unter Spielenden | 3 | **offen** |  |
| [[REQ-201]] | Aus dem Chat wird Inhalt | 3 | **offen** |  |
| [[REQ-202]] | Chats bleiben privat | 2 | **offen** |  |

### F-078 Beute

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-332]] | Beute öffnen und nehmen | 3 | **offen** |  |

### F-079 Tragplätze

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-334]] | Tragende Ausrüstung als Behälter mit eigenem Raster | 2 | **offen** |  |
| [[REQ-335]] | Verbund: Zellen, die gemeinsam ein Stück tragen | 2 | **offen** |  |
| [[REQ-336]] | Festlegen, wo ein Gegenstand getragen werden darf | 2 | **offen** |  |
| [[REQ-337]] | Sehen, was weichen muss | 2 | **offen** |  |
| [[REQ-338]] | Körperplätze als Plan des Moduls | 2 | **offen** |  |
| [[REQ-339]] | Tragende Ausrüstung an der Figur | 2 | **offen** |  |
| [[REQ-340]] | Raster und Zonen eines Trägers in der Maske | 3 | **offen** |  |

## EP-05 Kampagne & Sitzungen

Kampagnenmanager, Bereich Story (Arcs, Quests, Szenen), Sitzungen und Vorbereitung, Begegnungen, Abenteuer übernehmen, Party, Ladebildschirm.

**Arten:** [Campaign](../docs/Artikeltypen.md#campaign), [Story](../docs/Artikeltypen.md#story), [Arc](../docs/Artikeltypen.md#arc), [Quest](../docs/Artikeltypen.md#quest), `Scene`, [Session](../docs/Artikeltypen.md#session), [Encounter](../docs/Artikeltypen.md#encounter), [Party](../docs/Artikeltypen.md#party), [Board](../docs/Artikeltypen.md#board)

**Kanten:** `partyOf`, `memberOfParty`, `questGiver`, `questAbout`, `happensAt`, `participates`, `involves`, `placed`, `chapterOf`

**Code:** `packages/model/src/board.ts`, `packages/model/src/parts.ts`, `apps/web/src/app/boards`, `apps/web/src/app/verwaltung`, `apps/server/src/gruppe.ts`

**Erklärt in:** [Datenmodell.md](../docs/Datenmodell.md), [Spieltisch.md](../docs/Spieltisch.md)

**Offen mit Prio 1–3:** REQ-079 Schnelle Aktionen in der Sitzung (teils) · REQ-080 Vorlesetexte nach der Sitzung freigeben (offen) · REQ-086 Gruppenübersicht (teils) · REQ-180 Gepflanzte Fäden (offen) · REQ-221 Begegnungen bauen (offen) · REQ-236 Kampagne mit Dialog anlegen (offen) · REQ-279 Kampagnenwerte pflegen und in Texten nutzen (teils) · REQ-282 Sitzungsansicht für das Spiel (offen) · REQ-283 Kampagnen-Ladebildschirm (offen)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-029 Kampagne

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-043]] | Einstellungen der Kampagne | 2 | **steht** | Registerteil `settings` |
| [[REQ-075]] | Die Kampagne als Wurzel | 1 | **steht** | `Campaign`, `settings`, Zeitleiste |
| [[REQ-236]] | Kampagne mit Dialog anlegen | 2 | **offen** | Kampagne anlegen ohne Dialog |
| [[REQ-278]] | Bereiche als eigene Seiten | 1 | **steht** | `area` am Typ |
| [[REQ-279]] | Kampagnenwerte pflegen und in Texten nutzen | 2 | **teils** | Auflösung steht; Maske fehlt |

### F-030 Bereich Story

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-076]] | Geschichte gliedern | 1 | **steht** | `Story` (`kind`: adventure …) · Campaign · Arc · Session · Scene, Hierarchie über `partOf` |
| [[REQ-080]] | Vorlesetexte nach der Sitzung freigeben | 3 | **offen** |  |
| [[REQ-082]] | Quests mit Aufgaben und Lohn | 3 | **steht** | `Quest.tasks`, `reward`, `restriction`; Auftragsbrett |
| [[REQ-180]] | Gepflanzte Fäden | 3 | **offen** | keine Art und kein Feld für gepflanzte Fäden |

### F-031 Sitzungen & Vorbereitung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-077]] | Sitzungen mit Geplantem und Geschehenem | 2 | **steht** | `Session`, `Encounter.phase` |
| [[REQ-078]] | Vorbereitungsseite | 2 | **steht** | Element `prep` |
| [[REQ-079]] | Schnelle Aktionen in der Sitzung | 2 | **teils** | Wissen zuteilen im Seitenpanel; kein Ein-Tipp-Knopf in der Sitzung |
| [[REQ-084]] | Ideen und Unfertiges | 3 | **steht** | Unfinished, Todos |
| [[REQ-188]] | Übersicht über alles Unfertige | 3 | **steht** | Unfinished |
| [[REQ-189]] | Gesammelte Todos | 3 | **steht** | `Todos`, gesammelt |
| [[REQ-190]] | Schnellerfassung im Spiel | 3 | **steht** | Schnellerfassung an der Sitzung |
| [[REQ-280]] | Umschalter Vorbereitung und Spiel | 4 | **offen** | ob nötig, ist offen |
| [[REQ-282]] | Sitzungsansicht für das Spiel | 2 | **offen** | Vorbereitungsseite steht (REQ-078), Spielansicht nicht |

### F-032 Begegnungen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-085]] | Begegnungen | 2 | **steht** | `Encounter`, `participates`, `onMap`, `loot`, `tableFor` |
| [[REQ-172]] | Begegnungstabellen je Gebiet | 3 | **steht** | `entry.weight`, `requiresTag`, `tableFor` |
| [[REQ-173]] | Weltzustand zwischen Sitzungen | 4 | **offen** |  |
| [[REQ-221]] | Begegnungen bauen | 3 | **offen** |  |

### F-033 Abenteuer übernehmen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-240]] | Abenteuer als eigene Ebene | 2 | **steht** | je Abenteuer eine Ebene mit Kapiteln aus Teilen (T-082, T-108, E-018, E-029) |
| [[REQ-252]] | Abenteuer modular übernehmen | 2 | **steht** | `take` mit allem darunter (E-026) |

### F-034 Party

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-086]] | Gruppenübersicht | 3 | **teils** | Party-Seite mit Inventar und Werkbank; keine Übersicht der passiven Wahrnehmung |
| [[REQ-122]] | Gruppe als Widget | 3 | **steht** | Party-Seite |
| [[REQ-281]] | Eine Party je Kampagne | 1 | **steht** | `Party`, `partyOf`, `memberOfParty` (T-100, E-007) |

### F-035 Ladebildschirm-Board

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-283]] | Kampagnen-Ladebildschirm | 3 | **offen** |  |

### F-036 Sitzungsmitschnitt

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-196]] | Sitzung aufnehmen | 4 | **offen** |  |
| [[REQ-197]] | Transkript und Recap-Entwurf | 4 | **offen** |  |
| [[REQ-198]] | Sprecher im Transkript | 5 | **offen** |  |

## EP-06 Welt & Lore

Bereich World: Orte, Fraktionen, Gottheiten, Lore, Kalender und Zeitleisten, Beziehungen, Läden und Wirtschaft.

**Arten:** [World](../docs/Artikeltypen.md#world), [Place](../docs/Artikeltypen.md#place), [Faction](../docs/Artikeltypen.md#faction), [Deity](../docs/Artikeltypen.md#deity), [Event](../docs/Artikeltypen.md#event), [Article](../docs/Artikeltypen.md#article), [Shop](../docs/Artikeltypen.md#shop), [Material](../docs/Artikeltypen.md#material)

**Kanten:** `livesIn`, `memberOf`, `worships`, `controls`, `sells`, `discount`, `shopkeeper`, `regards`, `inWorld`

**Code:** `packages/model/src/timeline.ts`, `packages/model/src/shop.ts`, `apps/server/src/laden.ts`, `apps/web/src/app/artikel/laden.ts`

**Erklärt in:** [Beziehungen.md](../docs/Beziehungen.md), [Datenmodell.md](../docs/Datenmodell.md)

**Offen mit Prio 1–3:** REQ-025 Kalender der Welt (offen) · REQ-285 Fraktionspreise (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-037 Bereich World

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-101]] | Lore-Artikel | 2 | **steht** | `Article` mit poem/song |
| [[REQ-103]] | Orte mit Hierarchie | 2 | **steht** | `Place.kind`, `environment`, `partOf` |
| [[REQ-104]] | Fraktionen | 2 | **steht** | `Faction.kind`, `controls`, `memberOf` |
| [[REQ-107]] | Gottheiten und Pantheons | 4 | **offen** | eine Zeile, wenn gebraucht |
| [[REQ-110]] | Illustrierte Bibliothek | 5 | **offen** | Aufgabe #59 Portal |

### F-038 Kalender & Zeitleisten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-024]] | Weltdatum | 1 | **steht** | `Time.sort` (sortierbar), `Time.display`, `Time.calendar` |
| [[REQ-025]] | Kalender der Welt | 3 | **offen** | nur die Einstellung `calendar`; keine Kalenderzeile |
| [[REQ-087]] | Kalendermodul | 5 | **offen** |  |
| [[REQ-106]] | Ereignisse und Zeitleisten | 3 | **steht** | `Event`, `Time`, Element `timeline` |
| [[REQ-220]] | Zeitleisten der Weltgeschichte | 3 | **steht** | Spuren = `Event` mit Spanne, Inhalt über `partOf` (D57), Kampagne als Spur; `worldHistory` im Modell, Reiter im Element `timeline` (Prototyp) |

### F-039 Beziehungen & Ruf

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-030]] | Ruf als gewichtete Marken | 2 | **ersetzt** | Kante `regards` mit Marken (Beziehungen.md) |
| [[REQ-061]] | Beziehungen zwischen Figuren | 2 | **steht** | `owes`, `memberOf`, `livesIn`, `regards` |
| [[REQ-081]] | Ruf, der sich ausbreitet | 4 | **ersetzt** | siehe REQ-030 |

### F-040 Läden & Wirtschaft

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-185]] | Andere Währungen und Tausch | 5 | **offen** |  |
| [[REQ-284]] | Läden mit Waren und Preisen | 2 | **steht** | T-129, T-133 |
| [[REQ-285]] | Fraktionspreise | 3 | **teils** | `discount` nach Rang, `controls` |

### F-041 Namensgenerator

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-254]] | Namensgenerator | 4 | **offen** | später |

## EP-07 Regeln & Nachschlagen

Bereich Rules und Kompendium, Bücher und Leseansicht, Klassen, Zauber, Zustände, Handwerk, Regelsysteme und die Auswertung von Regeln.

**Arten:** `Rule`, [Condition](../docs/Artikeltypen.md#condition), [Disease](../docs/Artikeltypen.md#disease), [Spell](../docs/Artikeltypen.md#spell), [Class](../docs/Artikeltypen.md#class), [Recipe](../docs/Artikeltypen.md#recipe), [Skill](../docs/Artikeltypen.md#skill), [Language](../docs/Artikeltypen.md#language), [Action](../docs/Artikeltypen.md#action), [Table](../docs/Artikeltypen.md#table), [Chapter](../docs/Artikeltypen.md#chapter), [Heading](../docs/Artikeltypen.md#heading), [Paragraph](../docs/Artikeltypen.md#paragraph), `ReadAloudText`, `Embed`

**Kanten:** `casts`, `affects`, `stageOf`, `grants`, `needs`, `yields`, `craftsWith`, `crafting`, `tableFor`, `entry`, `describedIn`, `chapterOf`

**Code:** `packages/model/src/effects.ts`, `packages/model/src/crafting.ts`, `packages/model/src/book.ts`, `packages/model/src/reading.ts`, `apps/server/src/handwerk.ts`, `apps/web/src/app/lesen`, `apps/web/src/app/klassen`, `apps/web/src/app/artikel/werkstatt.ts`

**Erklärt in:** [Regelsysteme.md](../docs/Regelsysteme.md), [Datenmodell.md](../docs/Datenmodell.md)

**Offen mit Prio 1–3:** REQ-018 Wirkungen von Regeln beschreiben (offen) · REQ-092 Zauber als Artikel (offen) · REQ-227 Masse im Fliesstext umrechnen (offen) · REQ-287 Regelsysteme und Module als Ebenen (offen) · REQ-289 Homebrew-Regeln erfassen (offen) · REQ-313 Zustände als Artikel (teils) · REQ-319 Inventarregeln als wählbares Modul (offen) · REQ-357 Regelgraphen wirken am Tisch (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-042 Bereich Rules & Kompendium

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-089]] | Regeln als Artikel | 1 | **steht** | `Rule`, `Feat`, `Skill` |
| [[REQ-091]] | Regeln durchsuchen | 2 | **steht** | Bereich Rules mit Filter |
| [[REQ-094]] | Regeln an Artikel hängen | 2 | **steht** | `hasProperty`, `composedOf`; die Ebene über `inLayer` |
| [[REQ-098]] | Regel in Sekunden | 2 | **steht** | Verweise im Text, Merkzettel |
| [[REQ-099]] | Regeln anheften | 3 | **steht** | Merkzettel (pinned) |
| [[REQ-313]] | Zustände als Artikel | 2 | **teils** | Wirkung `affects` gespeichert, nicht ausgewertet |

### F-043 Bücher & Leseansicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-247]] | Bücher lesen | 2 | **steht** | `/read/:layer` mit Inhaltsverzeichnis, Suche, Lesestand (T-091, T-108); Reiter „Read“ am Ebenen-Artikel, Vorschau vor dem Aufschalten, Regal einer Gruppe, aufklappbares Verzeichnis (T-167) |

### F-044 Klassen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-231]] | Klassen wie im Buch | 3 | **steht** | `/classes`: Stufentabelle, Merkmale je Stufe, optionale zuschaltbar, Unterklassen filtern und vergleichen (`classes.ts`, W6, D65) |

### F-045 Zauber

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-092]] | Zauber als Artikel | 2 | **offen** | keine Art für Zauber — Abgleich A9 |
| [[REQ-097]] | Zauberlisten | 3 | **steht** | Kante spellList (Class, Subclass → Spell) aus 5e.tools, Facette am Zauber, usable by — T-212, Datenmodell Z7 |

### F-046 Regelauswertung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-017]] | Begriffe je Regelsystem auswerten | 4 | **offen** |  |
| [[REQ-018]] | Wirkungen von Regeln beschreiben | 1 | **offen** | keine `effects[]`; Regeln sind Text mit `{VAR}` |
| [[REQ-093]] | Regeln auswerten | 5 | **offen** |  |
| [[REQ-095]] | Gewährtes anwenden | 4 | **offen** |  |
| [[REQ-096]] | Einschränkungen prüfen | 5 | **offen** |  |
| [[REQ-290]] | Wechselwirkungen von Regeln auswerten | 4 | **offen** | für später |
| [[REQ-357]] | Regelgraphen wirken am Tisch | 3 | **teils** | Option Rules from graphs (Campaign.ruleGraphs): der Zugplan sendet leavesReach, attacked, hit/missed, damaged; Reaktionen werden angeboten, die Gelegenheitsattacke kommt aus ihrer Regel. Offen: castsSpell, picksUpObject, turnStart, Folgen mit Wirkung, Fassungen. |

### F-047 Handwerk

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-184]] | Handwerk mit Rezepten | 4 | **steht** | `Recipe`, `needs`, `yields`, `crafting` |
| [[REQ-218]] | Blaupausen lernen | 3 | **steht** | gelernt über `knownBy`, Werkbank mit Filtern (Prototyp, D55) |
| [[REQ-219]] | Material beim Start binden | 3 | **steht** | beim Start gebunden in `crafting.props.put` (D55); was ein Misserfolg kostet, sagt `Campaign.craftFailure` (T-165) |
| [[REQ-347]] | Handwerk an der Figur | 2 | **steht** | Reiter Crafting an der Figur auf der Werkbank (T-247, T-128, T-197) |
| [[REQ-349]] | Wie Blaupausen gelernt werden, ist eine Regeloption | 1 | **steht** | T-280: Campaign.craftLearning (all · taught · rarity) mit craftLearnRarity; gerechnet in blueprintKnown |

### F-048 Regelsysteme & Module

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-223]] | Rahmen für Regelsysteme wie Taverne | 4 | **offen** |  |
| [[REQ-287]] | Regelsysteme und Module als Ebenen | 2 | **offen** | E-044, T-132; entschieden als Ebenen: E-078, E-090–E-094 |
| [[REQ-289]] | Homebrew-Regeln erfassen | 3 | **offen** | wenn das Gerüst steht |
| [[REQ-319]] | Inventarregeln als wählbares Modul | 2 | **offen** |  |

### F-049 Masse & Einheiten

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-227]] | Masse im Fliesstext umrechnen | 3 | **offen** | umgerechnet werden nur Felder mit `unit` und Angriffszeilen (`convertText`, W2) |

## EP-08 Live-Spiel

Bereich Play: Spielleiter-Schirm, Initiative, Sitzungszustand und Live-Kanal, Würfel, Werkzeuge am Tisch.

**Arten:** [Encounter](../docs/Artikeltypen.md#encounter), [Session](../docs/Artikeltypen.md#session), [Board](../docs/Artikeltypen.md#board)

**Kanten:** `participates`, `onMap`

**Code:** `apps/server/src/live.ts`, `packages/model/src/initiative.ts`, `packages/model/src/dice.ts`, `apps/web/src/app/kern/live.ts`, `apps/web/src/app/karten/play.ts`

**Erklärt in:** [Architektur.md](../docs/Architektur.md), [Spieltisch.md](../docs/Spieltisch.md)

**Offen mit Prio 1–3:** REQ-113 Notiz-Widget (offen) · REQ-114 Schnellanlage auf dem Schirm (teils) · REQ-120 Spielprotokoll (teils) · REQ-123 Timer (offen) · REQ-128 Kampf aus Sicht der Spielenden (teils) · REQ-187 Tischanzeige (offen) · REQ-204 Spielleiter-Schirm (offen) · REQ-205 Ein Board je Geschichtsartikel (teils) · REQ-292 Neuen Artikel aus einer Auswahl anlegen (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-050 Spielleiter-Schirm

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-187]] | Tischanzeige | 3 | **offen** |  |
| [[REQ-204]] | Spielleiter-Schirm | 3 | **offen** |  |
| [[REQ-205]] | Ein Board je Geschichtsartikel | 3 | **teils** | ein Board je Geschichtsartikel über `partOf`, Liste und Anlegen in der Seite (W4, D63); offen: Umschalten auf dem Schirm, Filter nach Artikeln aus offenen Boards |

### F-051 Initiative

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-115]] | Initiative | 2 | **steht** | `participates` mit init, hp, conditions (je Eintrag ein Artikel der Art `Condition`, Runden, Quelle) |
| [[REQ-128]] | Kampf aus Sicht der Spielenden | 3 | **teils** | dieselbe Ansicht, gesiebt |
| [[REQ-144]] | Initiative auf der Karte | 4 | **steht** |  |
| [[REQ-211]] | Initiative wie Improved Initiative | 2 | **steht** | Prototyp: RK und TP-Maximum vom Statblock der Instanz (`participantStats`), Statblock in `quick` neben der Reihe (D53) |
| [[REQ-212]] | Zustände und Notizen mit Dauer | 2 | **steht** | `anchor`/`at` an `participates.props.conditions`, Notiz mit `text`; `tickEntries`, `expiresAt` (D53) |
| [[REQ-213]] | Initiative der Spielenden | 3 | **steht** | `redactParticipants` in `redactEntity` und im Prototyp; `turn` geht nicht an Spielende, `props.current` statt dessen (D53, D58) |
| [[REQ-226]] | Gegner erscheinen in Runde 1 erst in ihrem Zug | 3 | **steht** | Runde 1: Gegner erst in ihrem Zug (`turnHasCome`, `initiativeOrder`), in `redactParticipants`/`redactEntity` und im Prototyp (D58) |

### F-052 Sitzungszustand & Live-Kanal

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-116]] | Was gerade läuft, steht an der Sitzung | 2 | **steht** | `Session.activeMap/activeEncounter/activeScene`; Raum-Kanal für Augenblicke |
| [[REQ-117]] | Wer am Sitzungszustand schreibt | 3 | **steht** | `Session.stewardship` gm/table |
| [[REQ-120]] | Spielprotokoll | 3 | **teils** | Würfe im Protokoll; Zustandsereignisse nicht gespeichert |
| [[REQ-121]] | Statistik | 4 | **offen** |  |

### F-053 Würfel

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-070]] | Würfeln | 2 | **steht** |  |
| [[REQ-071]] | Würfe für alle | 4 | **steht** | Würfe über den Raum-Kanal, Protokoll |

### F-054 Werkzeuge am Tisch

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-112]] | Widget mit mehreren offenen Artikeln | 2 | **ersetzt** | Platzierungen auf dem Board |
| [[REQ-113]] | Notiz-Widget | 2 | **offen** | Aufgabe #58 |
| [[REQ-114]] | Schnellanlage auf dem Schirm | 2 | **teils** | Anlegen aus dem Board |
| [[REQ-118]] | Begegnung starten | 3 | **steht** | Begegnung mit Teilnehmern und Tabellen |
| [[REQ-123]] | Timer | 3 | **offen** |  |
| [[REQ-124]] | Auftragsbrett als Widget | 3 | **steht** | Element `quests` |
| [[REQ-125]] | Zufallstabellen | 3 | **steht** | `Table.kind` loot · encounter · name · shop · event · generic |
| [[REQ-126]] | Musik einbinden | 4 | **teils** | `Session.nowPlaying` als Feld; kein Einbetten |
| [[REQ-127]] | Eigene Klangtafel | 5 | **offen** |  |
| [[REQ-129]] | Fragen an einen Assistenten | 5 | **offen** |  |
| [[REQ-186]] | Verschachtelte Tabellen | 3 | **steht** | `entry` auf eine Tabelle |
| [[REQ-292]] | Neuen Artikel aus einer Auswahl anlegen | 2 | **teils** |  |

## EP-09 Karten

Karte und Kartenebenen, Tokens und Marker, Nebel, Licht und Sicht, Bewegung und Zonen, Gebiete, Reisen, Karteneditor.

**Arten:** [Map](../docs/Artikeltypen.md#map), `ZoneKind`

**Kanten:** `mapOf`, `insideMap`, `marker`, `zone`, `territory`, `onMap`, `route`

**Code:** `packages/model/src/map.ts`, `packages/model/src/movement.ts`, `packages/model/src/sight.ts`, `apps/server/src/karten.ts`, `apps/web/src/app/karten`

**Erklärt in:** [Karten.md](../docs/Karten.md)

**Offen mit Prio 1–3:** REQ-132 Kartenebene festhalten (offen) · REQ-135 Tokens im Spiel (teils) · REQ-208 Zonen mit eigenen Regeln (teils) · REQ-210 Karte und Initiative im Vollbild (teils) · REQ-294 Token ohne Bild zeigt den Anfangsbuchstaben (teils) · REQ-312 Eigenes Token bewegen (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-055 Karte & Kartenebenen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-130]] | Karte mit Gitter und Massstab | 3 | **steht** | `Map` mit Gitter, Massstab, `mapOf` |
| [[REQ-131]] | Unterkarten zum Hineinzoomen | 3 | **steht** | `insideMap` mit Rahmen, Hineinzoomen |
| [[REQ-132]] | Kartenebene festhalten | 3 | **offen** |  |
| [[REQ-138]] | Grosse Karten in Kacheln | 4 | **steht** | `Map.tiles` |
| [[REQ-293]] | Ladeanzeige für Kartenbilder | 3 | **steht** | T-126 |

### F-056 Tokens & Marker

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-133]] | Marker, die zu Artikeln führen | 3 | **steht** | `marker` |
| [[REQ-134]] | Kulisse auf der Karte | 4 | **steht** | `marker.kind: scenery` |
| [[REQ-135]] | Tokens im Spiel | 3 | **teils** | Tokens als Kanten; keine getrennte Lebensdauer je Sitzung |
| [[REQ-136]] | Gruppe und Quests auf der Karte | 3 | **steht** | Gruppen-Token, `{PARTYWHERE}` |
| [[REQ-224]] | Kreaturen nach Grösse auf der Karte | 3 | **steht** | Platz nach `Statblock.size` beim Lesen (`sizeSpan`, Instanz über `resolveInstance`), gespeichert die Mitte, gerechnet über den Anker; Rechner mit `MoveGrid.span` (ganzer Platz passt, Wände je Feld, teuerstes neu betretenes Feld), Sperren und Reichweite vom ganzen Platz, Sicht Feld zu Feld (`bestNotice`); tiny teilt (D58) |
| [[REQ-294]] | Token ohne Bild zeigt den Anfangsbuchstaben | 3 | **teils** | Anfangsbuchstabe ja; Deckname nicht geprüft |

### F-057 Nebel, Licht & Sicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-139]] | Nebel | 4 | **steht** | `Map.reveal` |
| [[REQ-140]] | Licht und Sicht mit Wänden | 5 | **steht** | `marker.light/dim`, `Map.walls`, `visionPoly` |
| [[REQ-209]] | Aufdecken von Hand oder entlang des Pfads | 3 | **steht** | Sieht / wird gesehen von am gewählten Token, Aufdecken von Hand; beim Bestätigen entlang des Pfads Schritt für Schritt (Tokens, versteckte Zonen, Nebel); Sichtlinie, PP gegen Heimlichkeit, −5 im Dämmerlicht (`sight.ts`, D56) |

### F-058 Bewegung & Zonen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-206]] | Bewegungsrechner | 3 | **steht** | Rechner 5-10-5 über Feld × Parität (`movement.ts`, Prototyp `mvSearch`), Modi genau · Reichweite · aus, Tempo als Zahl in `Session.moves` mit Kurzwahl, SL setzt frei und bestätigt über das Tempo hinaus; nur Quadratraster (D56) |
| [[REQ-207]] | Pfad mit Wegpunkten | 3 | **steht** | Wegpunkte per Klick, günstigster Weg dazwischen, Parität läuft weiter (`pathVia`); Gefahren und Reichweite von Gegnern meidbar (D56) |
| [[REQ-208]] | Zonen mit eigenen Regeln | 3 | **teils** | `ZoneKind` (Regelartikel) + Kante `zone`: Kosten, Licht und Verdeckung in Weg und Sicht, versteckt bis PP n; Schaden/Rettungswurf/Zustand gezeigt und beim Betreten in `Session.log`. Offen: Auslöser zu Zugbeginn/-ende, Zonenlicht in der Dunkelheitsmaske (D56) |
| [[REQ-210]] | Karte und Initiative im Vollbild | 3 | **teils** | Prototyp: Vollbild für Karte und Initiative, SL-/Spieleransicht der Karte, Spielende bewegen eigene Tokens; offen: `redactEntity` hält versteckte Marker am Server nicht zurück (D56) |
| [[REQ-312]] | Eigenes Token bewegen | 2 | **teils** | Prototyp ja; in der Seite noch nicht für Spielende |

### F-059 Gebiete & Overlays

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-137]] | Hervorhebungen nach Abfrage | 4 | **teils** | `territory` von Hand; keine Abfrage |
| [[REQ-193]] | Gebiete auf der Karte | 4 | **steht** | `territory` |

### F-060 Reisen & Erkundung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-168]] | Point-Crawl | 3 | **steht** | `route` mit signal, `Place.state` |
| [[REQ-169]] | Erkundungsstand | 3 | **steht** | `Place.state` hidden · discovered · explored |
| [[REQ-170]] | Vorräte auf Reisen | 4 | **steht** | Einstellungen `travel*`, `Party.sinceRation/sinceLight` |
| [[REQ-171]] | Aktionen je Knoten | 4 | **steht** | `Party.actions`: Figur → Regelartikel `kind: travel` |

### F-061 Karteneditor

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-141]] | Effekte auf der Karte | 5 | **offen** |  |
| [[REQ-142]] | Auf Karten zeichnen | 5 | **offen** | Aufgabe #60 |
| [[REQ-143]] | Karteneditor | 5 | **offen** |  |

## EP-10 Medien & Assets

Bilder und Dateien: Ablage, Bildverwaltung und Bildklassen, Token-Werkstatt, Druck und Ausfuhr, PDF.

**Arten:** [Asset](../docs/Artikeltypen.md#asset), `Image`

**Code:** `apps/server/src/bilder.ts`, `apps/server/src/assets.ts`, `packages/model/src/assets.ts`, `apps/web/src/app/bilder`, `apps/web/src/app/artikel/druck.ts`

**Erklärt in:** [Betrieb.md](../docs/Betrieb.md), [Datenmodell.md](../docs/Datenmodell.md)

**Offen mit Prio 1–3:** REQ-022 Vorschaubilder und Kacheln (offen) · REQ-145 Ablage in der Seite (teils) · REQ-146 Grosse Dateien auf dem NAS (offen) · REQ-147 Bilder hochladen (teils) · REQ-167 Drucken (offen) · REQ-295 Bild ersetzen als Fassung oder neue Quelle (offen) · REQ-296 Bildklassen (teils) · REQ-297 Bilder aus 5e.tools einlesen und verknüpfen (offen) · REQ-329 Bilder im Inventar (offen) · REQ-330 Inventory image an einen Gegenstand binden (offen)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-062 Asset-Ablage

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-020]] | Quelle eines Artikels | 1 | **steht** | `Source`: publication, page, anchor, url |
| [[REQ-021]] | Dateien als Assets | 1 | **steht** | `Asset`: backend app/external, ref, mime, width, height, bytes |
| [[REQ-022]] | Vorschaubilder und Kacheln | 3 | **offen** |  |
| [[REQ-145]] | Ablage in der Seite | 1 | **teils** | Assets als Artikel; Ablage im Artefakt |
| [[REQ-146]] | Grosse Dateien auf dem NAS | 2 | **offen** |  |
| [[REQ-148]] | Bilder von aussen | 3 | **steht** | `Asset.backend: external` |
| [[REQ-150]] | Audio ablegen | 5 | **offen** |  |
| [[REQ-151]] | 3D-Dateien | 5 | **offen** |  |

### F-063 Bildverwaltung

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-147]] | Bilder hochladen | 2 | **teils** | Prototyp ja; Server noch nicht |
| [[REQ-295]] | Bild ersetzen als Fassung oder neue Quelle | 3 | **offen** |  |
| [[REQ-296]] | Bildklassen | 3 | **teils** | `Asset.kind` (T-119); Übersicht fehlt |
| [[REQ-297]] | Bilder aus 5e.tools einlesen und verknüpfen | 3 | **offen** |  |
| [[REQ-329]] | Bilder im Inventar | 3 | **offen** |  |

### F-064 Token-Werkstatt

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-298]] | Bilder bearbeiten und Tokens zusammenstellen | 4 | **offen** |  |
| [[REQ-330]] | Inventory image an einen Gegenstand binden | 3 | **offen** |  |
| [[REQ-331]] | Hilfe für Gegenstandsbilder | 4 | **offen** |  |

### F-065 Druck & Ausfuhr

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-029]] | Ausfuhr und Einfuhr | 3 | **steht** | Ausfuhr/Einfuhr als eine Datei; Register allein (`register-datei.mjs`) |
| [[REQ-167]] | Drucken | 3 | **offen** |  |
| [[REQ-195]] | Statblock nach Obsidian ausführen | 4 | **offen** |  |

### F-066 PDF & OCR

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-149]] | PDF mit Seitensprung | 4 | **offen** |  |
| [[REQ-152]] | Texte aus PDF erkennen | 5 | **offen** |  |

## EP-11 Oberfläche & Navigation

Boards, Suche, Filter und Filtergruppen, Navigation und Kurzansicht, Bearbeiten in der Ansicht, Design und Stilkonzept.

**Arten:** [Board](../docs/Artikeltypen.md#board)

**Kanten:** `placed`

**Code:** `apps/web/src/app/suche`, `apps/web/src/app/kern`, `apps/web/src/app/artikel/kurzpopup.ts`, `apps/web/src/app/neues`, `apps/server/src/filtergruppen.ts`, `packages/model/src/views.ts`, `packages/model/src/facets.ts`

**Erklärt in:** [Architektur.md](../docs/Architektur.md), [UI-Arbeitsplan.md](../docs/UI-Arbeitsplan.md), [Web-Arbeitsplan.md](../docs/Web-Arbeitsplan.md), [design](../docs/design)

**Offen mit Prio 1–3:** REQ-028 Volltextsuche (teils) · REQ-119 Boards der Spielenden (offen) · REQ-160 Zwischen Ankern springen (teils) · REQ-166 Auf dem Board anlegen (teils) · REQ-291 Leseansicht auf dem Board (offen) · REQ-300 Gestaltung wie die Bücher (teils) · REQ-345 Schwebende Werkzeugleiste für eine Auswahl (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-067 Boards

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-111]] | Boards | 2 | **steht** | `Board`, `placed` |
| [[REQ-119]] | Boards der Spielenden | 3 | **offen** |  |
| [[REQ-157]] | Frei anordnen auf dem Board | 2 | **steht** | `placed` mit x, y, w, h, z; in der Seite die Leinwand `/boards` (W4) |
| [[REQ-158]] | Ansicht je Platzierung | 2 | **steht** | `placed.view` |
| [[REQ-159]] | Anker und Bereiche auf dem Board | 3 | **steht** | `Board.anchors`; in der Seite als Reiter über dem Board, mit Rechteck ein einklappbarer Bereich (T-073) |
| [[REQ-160]] | Zwischen Ankern springen | 3 | **teils** |  |
| [[REQ-161]] | Regeln für die Darstellung | 2 | **steht** | `Board.rules`, `placed.view`; ohne beides wählt die Grösse der Kachel (`placementView`, D63) |
| [[REQ-162]] | Semantischer Zoom | 4 | **offen** |  |
| [[REQ-165]] | Bilder, Formen und Werkzeuge auf dem Board | 2 | **steht** | `Board.shapes`, Assets als Platzierung (Prototyp); die Seite zeichnet Anker und Bereiche (T-073), Formen noch nicht (W4) |
| [[REQ-166]] | Auf dem Board anlegen | 2 | **teils** | Anlegen auf dem Board |
| [[REQ-291]] | Leseansicht auf dem Board | 3 | **offen** |  |
| [[REQ-358]] | Kampagnenboard als Startpunkt für Spielende | 2 | **steht** | Je Kampagne ein Board (beim Anlegen, bestehende beim ersten Öffnen), Abfrage-Kacheln mit laufenden Quellen (Szene, Arc, Sitzung, nächste Sitzung, Gruppe, offene Aufträge), Gerüchte zum Ziehen; Spielende landen darauf (Campaign.playerStart), Basis-Leiste Board · My character · Maps · Search · Knowledge (T-342). |

### F-068 Suche

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-028]] | Volltextsuche | 3 | **teils** | Suche am Server über Name, Alias, Deckname und Nummer, Feldfilter als Facetten (`GET /api/list`, W7); keine Volltextsuche |
| [[REQ-304]] | Übergreifende Suche beim Tippen | 1 | **steht** | T-138 |

### F-069 Filter & Filtergruppen

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-302]] | Der Filter gehört der Seite | 3 | **steht** | `goPage` |
| [[REQ-303]] | Filtergruppen je Seite | 2 | **steht** | T-137, `list_filter` |
| [[REQ-318]] | Ein Ebenenfilter, global und speicherbar | 2 | **steht** | T-186: keine Ebenen-Häkchen mehr auf World/Story/Rules/Compendium; „Saved selections“ im Popup der Kopfleiste (`/api/me/layer-sets`); Filtergruppen ohne `layer`/`nolayer` (Migration 080 legt die alten Angaben nach `list_filter_ebenen_alt`) |

### F-070 Navigation & Kurzansicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-248]] | Kurzansicht überall | 2 | **steht** | `nwQuick`, `nw-kurzpopup`, Brotkrumen (T-093) |
| [[REQ-305]] | Kampagne und Ebene immer sichtbar | 2 | **steht** | T-143: Kampagne und Ebenen im Popup; T-161: Schreibebene in der Kopfleiste, wählbar, am Server je Konto und Kampagne |
| [[REQ-315]] | Globale Kopfleiste | 1 | **steht** |  |
| [[REQ-317]] | Zurück an dieselbe Stelle | 1 | **steht** | T-185: `Rueckweg` merkt den Scrollstand je Verlaufseintrag und stellt ihn bei „Zurück“ wieder her, sobald die Liste hoch genug ist; die Ebenenliste zeichnet den letzten Stand sofort |
| [[REQ-342]] | Handbuch: alle Erklärungen an einer Stelle | 1 | **steht** | `/handbook`, `help.json`, `RULE_OPTIONS.does`, `APP_TERMS`, Tests erzwingen das Nachziehen (T-242, T-225, T-205) |
| [[REQ-345]] | Schwebende Werkzeugleiste für eine Auswahl | 2 | **teils** | Muster `nw-werkzeugleiste` mit Blatt von unten, in „Your turn“ im Einsatz (T-247); Karte folgt |

### F-071 Bearbeiten in der Ansicht

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-299]] | Optionale Felder verdeckt | 3 | **steht** | Lesen: `empty` an der Ansicht; Bearbeiten: Pflicht- und befüllte Felder, „+ Add field“ mit Beschreibung (T-195) |
| [[REQ-307]] | Löschen mit Rückfrage in der Seite | 3 | **steht** |  |

### F-072 Design & Stilkonzept

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-153]] | Deutsche Oberfläche | 2 | **ersetzt** | Oberfläche englisch (19.9.) |
| [[REQ-300]] | Gestaltung wie die Bücher | 3 | **teils** | Pergament in `apps/web`; Design-Lauf offen |
| [[REQ-301]] | Stilkonzept in der Verwaltung anpassen | 4 | **offen** |  |
| [[REQ-306]] | Lesbarkeit im Feinschliff | 3 | **steht** | T-126 |

## EP-12 Import & Inhalte

5e.tools, Regelwerke anderer Verlage, Obsidian-Vault, Artikelprüfung und KI-erzeugte Inhalte — wie Inhalte hereinkommen und vollständig werden.

**Arten:** `Source`, [Layer](../docs/Artikeltypen.md#layer)

**Kanten:** `inLayer`, `overrides`

**Code:** `packages/import-5etools`, `scripts/regelwerk.mjs`, `apps/server/src/import.ts`, `apps/server/src/ausfuhr.ts`

**Erklärt in:** [5etools-Abgleich.md](../docs/5etools-Abgleich.md), [5etools-Arbeitsplan.md](../docs/5etools-Arbeitsplan.md), [5etools-Bericht.md](../docs/5etools-Bericht.md), [Betrieb.md](../docs/Betrieb.md), [Nachtarbeit](../docs/Nachtarbeit)

**Offen mit Prio 1–3:** REQ-288 Preise für jeden Gegenstand (teils) · REQ-308 Obsidian-Vault einlesen (offen) · REQ-314 Regelwerk eines Drittverlags laden (teils)

**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.

### F-073 5e.tools-Import

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-047]] | Import von 5e.tools, Improved Initiative und Obsidian als Einstieg | 2 | **verworfen** | Importer entfernt; wiederkommen heisst neu schreiben |
| [[REQ-090]] | Regeln aus Obsidian und 5e.tools einlesen | 2 | **verworfen** | siehe REQ-047 |
| [[REQ-233]] | 5e.tools über eine Pipeline laden | 3 | **steht** | `import-5etools.yml` und `deploy/import.sh`, `--only-new` (Vorgabe), `--replace-layer` nur ausdrücklich, `--dry-run`; nur von Hand, dev wie prod (W8, D67, D71) |
| [[REQ-239]] | Jedes Buch eine Ebene | 2 | **steht** | je Quelle eine Ebene (T-087) |
| [[REQ-243]] | Alle Inhalte als abschaltbare Ebenen | 2 | **steht** | jeder Regelstand in seiner Ebene (T-087) |

### F-074 Regelwerke anderer Verlage

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-314]] | Regelwerk eines Drittverlags laden | 3 | **teils** | T-122 |

### F-075 Obsidian-Vault

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-308]] | Obsidian-Vault einlesen | 3 | **offen** | die alten Importer sind weg (2026-09-20) |

### F-076 Artikelprüfung & Nachtarbeit

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-286]] | Artikel nachts auf Vollständigkeit prüfen | 3 | **steht** | T-089 |
| [[REQ-309]] | Claude darf auf dev ergänzen, mit Protokoll | 3 | **steht** | E23 |

### F-077 KI-Inhalte

| ID | Story | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| [[REQ-288]] | Preise für jeden Gegenstand | 3 | **teils** | T-139 (`priceNote`) läuft |

## Was offen ist und wehtut

Offene und teilweise Stories mit Priorität 1 bis 3, nach Priorität:

- **[[REQ-003]]** (1, teils, Inhaltsgerüst) — Änderungsverlauf je Artikel — *Server schreibt `event_log` (`entity.written`, `entity.deleted`); keine Anzeige, keine Kette*
- **[[REQ-006]]** (1, teils, Inhaltsgerüst) — Stapel: was in der Kampagne gilt — *Prototyp: `inStack`/`resolveArticle`; Server kennt nur die Zugehörigkeit (`campaignsOf`) — Abgleich A2*
- **[[REQ-008]]** (1, teils, Inhaltsgerüst) — Varianten einer Sache — *Kante `variantOf` da; kein Kopierknopf*
- **[[REQ-013]]** (1, teils, Inhaltsgerüst) — Verweise nach Nummer, getippt nach Name — *`[[Verweise]]` nach Name und Alias, Vorschläge beim Tippen, `Rule.autolink`; kein Auto-Link beim Schreiben*
- **[[REQ-018]]** (1, offen, Regeln & Nachschlagen) — Wirkungen von Regeln beschreiben — *keine `effects[]`; Regeln sind Text mit `{VAR}`*
- **[[REQ-069]]** (1, teils, Spielererlebnis) — Am Telefon spielen — *Spielerseite bei 390 px ohne Überlauf, Kopf eingeklappt (T-247); Inventar am Telefon wartet auf T-244*
- **[[REQ-100]]** (1, teils, Inhaltsgerüst) — Welt als Ebene — *`Layer.kind: world`; keine Mitglieder je Welt*
- **[[REQ-145]]** (1, teils, Medien & Assets) — Ablage in der Seite — *Assets als Artikel; Ablage im Artefakt*
- **[[REQ-344]]** (1, teils, Kreaturen & Figuren) — Gesperrte Aktionen bleiben sichtbar, mit Grund — *„Your turn“ und Spells sperren nach den Händen (T-247, T-246); das Ausrüsten selbst wartet auf T-244*
- **[[REQ-346]]** (1, teils, Spielererlebnis) — Was die Kampagne meiner Figur gezeigt hat — *Reiter Campaign an der Spielerfigur (T-247); „als Spieler sehen“ für die Leitung offen*
- **[[REQ-041]]** (2, teils, Zugang & Betrieb) — Wer was schreiben darf — *Verwaltung oder eigene Figur (+ carries/holds/crafting); die Leitung fehlt in `mayWrite`*
- **[[REQ-072]]** (2, offen, Spielererlebnis) — Eigene Notizen — *`Notes` an Artikeln; kein eigener Notizartikel je Spieler*
- **[[REQ-079]]** (2, teils, Kampagne & Sitzungen) — Schnelle Aktionen in der Sitzung — *Wissen zuteilen im Seitenpanel; kein Ein-Tipp-Knopf in der Sitzung*
- **[[REQ-092]]** (2, offen, Regeln & Nachschlagen) — Zauber als Artikel — *keine Art für Zauber — Abgleich A9*
- **[[REQ-102]]** (2, teils, Inhaltsgerüst) — Artikel je Stapel und Wissen zeichnen — *Prototyp ja; Server ohne Stapel — Abgleich A2*
- **[[REQ-113]]** (2, offen, Live-Spiel) — Notiz-Widget — *Aufgabe #58*
- **[[REQ-114]]** (2, teils, Live-Spiel) — Schnellanlage auf dem Schirm — *Anlegen aus dem Board*
- **[[REQ-146]]** (2, offen, Medien & Assets) — Grosse Dateien auf dem NAS
- **[[REQ-147]]** (2, teils, Medien & Assets) — Bilder hochladen — *Prototyp ja; Server noch nicht*
- **[[REQ-166]]** (2, teils, Oberfläche & Navigation) — Auf dem Board anlegen — *Anlegen auf dem Board*
- **[[REQ-202]]** (2, offen, Spielererlebnis) — Chats bleiben privat
- **[[REQ-236]]** (2, offen, Kampagne & Sitzungen) — Kampagne mit Dialog anlegen — *Kampagne anlegen ohne Dialog*
- **[[REQ-249]]** (2, teils, Inhaltsgerüst) — Ebenen nach Herausgeber — *`publisherOf` und Herausgeber-Gruppen (T-094, T-109); Kategorien wie die Blocklist von 5e.tools offen*
- **[[REQ-258]]** (2, teils, Inhaltsgerüst) — Verweisfeld nennt, welche Artikel es annimmt — *`PropertySchema.target`, `link_wrong_type`; Vorschläge in den Sichtbarkeitsfeldern für jede Art noch nicht überall*
- **[[REQ-264]]** (2, teils, Inhaltsgerüst) — Vergleichsebenen der Kampagne — *Vergleichsebenen an der Kampagne; Wahl im Kampagnen-Popup und gruppenweise offen*
- **[[REQ-269]]** (2, teils, Zugang & Betrieb) — Ankündigen, wann produktiv gearbeitet werden kann — *Freigabe für verlierende Migrationen steht; Zusage und Ankündigung fehlen*
- **[[REQ-270]]** (2, teils, Zugang & Betrieb) — Artikel von dev nach prod übernehmen — *Übernahme (T-130)*
- **[[REQ-275]]** (2, teils, Spielererlebnis) — Erhaltene Gegenstände als Instanz — *`instanceOf` am Item vorhanden (T-150 läuft)*
- **[[REQ-279]]** (2, teils, Kampagne & Sitzungen) — Kampagnenwerte pflegen und in Texten nutzen — *Auflösung steht; Maske fehlt*
- **[[REQ-282]]** (2, offen, Kampagne & Sitzungen) — Sitzungsansicht für das Spiel — *Vorbereitungsseite steht (REQ-078), Spielansicht nicht*
- **[[REQ-287]]** (2, offen, Regeln & Nachschlagen) — Regelsysteme und Module als Ebenen — *E-044, T-132; entschieden als Ebenen: E-078, E-090–E-094*
- **[[REQ-292]]** (2, teils, Live-Spiel) — Neuen Artikel aus einer Auswahl anlegen
- **[[REQ-311]]** (2, teils, Spielererlebnis) — Spieleransicht mit der eigenen Figur im Fokus — *Entwurf Player/PlayerPhone*
- **[[REQ-312]]** (2, teils, Karten) — Eigenes Token bewegen — *Prototyp ja; in der Seite noch nicht für Spielende*
- **[[REQ-313]]** (2, teils, Regeln & Nachschlagen) — Zustände als Artikel — *Wirkung `affects` gespeichert, nicht ausgewertet*
- **[[REQ-319]]** (2, offen, Regeln & Nachschlagen) — Inventarregeln als wählbares Modul
- **[[REQ-320]]** (2, offen, Spielererlebnis) — Formen frei malen, auch nicht rechteckig
- **[[REQ-321]]** (2, offen, Spielererlebnis) — Stapel im Raster
- **[[REQ-322]]** (2, offen, Spielererlebnis) — Besondere Zonen mit eigenen Regeln
- **[[REQ-323]]** (2, offen, Spielererlebnis) — Alle möglichen Plätze eines Gegenstands
- **[[REQ-324]]** (2, offen, Spielererlebnis) — Hände als Plätze mit Regeln
- **[[REQ-325]]** (2, offen, Spielererlebnis) — Gegenstandsartikel im Detailbereich
- **[[REQ-326]]** (2, offen, Spielererlebnis) — Ziehen und Ablegen im Raster
- **[[REQ-327]]** (2, offen, Spielererlebnis) — Packen am Telefon
- **[[REQ-328]]** (2, offen, Spielererlebnis) — Ablage für nicht Verstautes
- **[[REQ-333]]** (2, offen, Spielererlebnis) — Vorgaben für Formen und Stapel
- **[[REQ-334]]** (2, offen, Spielererlebnis) — Tragende Ausrüstung als Behälter mit eigenem Raster
- **[[REQ-335]]** (2, offen, Spielererlebnis) — Verbund: Zellen, die gemeinsam ein Stück tragen
- **[[REQ-336]]** (2, offen, Spielererlebnis) — Festlegen, wo ein Gegenstand getragen werden darf
- **[[REQ-337]]** (2, offen, Spielererlebnis) — Sehen, was weichen muss
- **[[REQ-338]]** (2, offen, Spielererlebnis) — Körperplätze als Plan des Moduls
- **[[REQ-339]]** (2, offen, Spielererlebnis) — Tragende Ausrüstung an der Figur
- **[[REQ-345]]** (2, teils, Oberfläche & Navigation) — Schwebende Werkzeugleiste für eine Auswahl — *Muster `nw-werkzeugleiste` mit Blatt von unten, in „Your turn“ im Einsatz (T-247); Karte folgt*
- **[[REQ-354]]** (2, offen, Zugang & Betrieb) — Wissenspunkte bei eigener Herkunft und eigenem Hintergrund
- **[[REQ-007]]** (3, offen, Inhaltsgerüst) — Stapel für Fortgeschrittene
- **[[REQ-022]]** (3, offen, Medien & Assets) — Vorschaubilder und Kacheln
- **[[REQ-025]]** (3, offen, Welt & Lore) — Kalender der Welt — *nur die Einstellung `calendar`; keine Kalenderzeile*
- **[[REQ-028]]** (3, teils, Oberfläche & Navigation) — Volltextsuche — *Suche am Server über Name, Alias, Deckname und Nummer, Feldfilter als Facetten (`GET /api/list`, W7); keine Volltextsuche*
- **[[REQ-045]]** (3, offen, Inhaltsgerüst) — Ebenen-Aktionen am Artikel
- **[[REQ-055]]** (3, offen, Kreaturen & Figuren) — Merkmale beim Tippen wiederverwenden — *Pool steht; Variante beim Tippen nicht*
- **[[REQ-060]]** (3, teils, Kreaturen & Figuren) — Begleiter und Beschwörungen — *`Creature.kind` companion/summon; keine `companionOf`-Kante*
- **[[REQ-074]]** (3, teils, Spielererlebnis) — Schnellzugriffe — *Bereich Play und die Leiste*
- **[[REQ-080]]** (3, offen, Kampagne & Sitzungen) — Vorlesetexte nach der Sitzung freigeben
- **[[REQ-083]]** (3, offen, Spielererlebnis) — Eigene Quests und Ziele — *Spieler schreiben nur ihre Figur*
- **[[REQ-086]]** (3, teils, Kampagne & Sitzungen) — Gruppenübersicht — *Party-Seite mit Inventar und Werkbank; keine Übersicht der passiven Wahrnehmung*
- **[[REQ-088]]** (3, teils, Zugang & Betrieb) — Massenänderungen an Wissen und Rechten — *Massenbearbeitung ohne Wissen*
- **[[REQ-109]]** (3, teils, Spielererlebnis) — Lore-Texte von Spielenden — *Felder da (`Article.poem/song`); Schreibrecht offen (REQ-041)*
- **[[REQ-119]]** (3, offen, Oberfläche & Navigation) — Boards der Spielenden
- **[[REQ-120]]** (3, teils, Live-Spiel) — Spielprotokoll — *Würfe im Protokoll; Zustandsereignisse nicht gespeichert*
- **[[REQ-123]]** (3, offen, Live-Spiel) — Timer
- **[[REQ-128]]** (3, teils, Live-Spiel) — Kampf aus Sicht der Spielenden — *dieselbe Ansicht, gesiebt*
- **[[REQ-132]]** (3, offen, Karten) — Kartenebene festhalten
- **[[REQ-135]]** (3, teils, Karten) — Tokens im Spiel — *Tokens als Kanten; keine getrennte Lebensdauer je Sitzung*
- **[[REQ-160]]** (3, teils, Oberfläche & Navigation) — Zwischen Ankern springen
- **[[REQ-167]]** (3, offen, Medien & Assets) — Drucken
- **[[REQ-176]]** (3, teils, Inhaltsgerüst) — Ähnliches vor dem Anlegen vorschlagen — *Vorschläge nach Name und Alias; keine Ähnlichkeit*
- **[[REQ-180]]** (3, offen, Kampagne & Sitzungen) — Gepflanzte Fäden — *keine Art und kein Feld für gepflanzte Fäden*
- **[[REQ-187]]** (3, offen, Live-Spiel) — Tischanzeige
- **[[REQ-200]]** (3, offen, Spielererlebnis) — Chat mit der Leitung und unter Spielenden
- **[[REQ-201]]** (3, offen, Spielererlebnis) — Aus dem Chat wird Inhalt
- **[[REQ-204]]** (3, offen, Live-Spiel) — Spielleiter-Schirm
- **[[REQ-205]]** (3, teils, Live-Spiel) — Ein Board je Geschichtsartikel — *ein Board je Geschichtsartikel über `partOf`, Liste und Anlegen in der Seite (W4, D63); offen: Umschalten auf dem Schirm, Filter nach Artikeln aus offenen Boards*
- **[[REQ-208]]** (3, teils, Karten) — Zonen mit eigenen Regeln — *`ZoneKind` (Regelartikel) + Kante `zone`: Kosten, Licht und Verdeckung in Weg und Sicht, versteckt bis PP n; Schaden/Rettungswurf/Zustand gezeigt und beim Betreten in `Session.log`. Offen: Auslöser zu Zugbeginn/-ende, Zonenlicht in der Dunkelheitsmaske (D56)*
- **[[REQ-210]]** (3, teils, Karten) — Karte und Initiative im Vollbild — *Prototyp: Vollbild für Karte und Initiative, SL-/Spieleransicht der Karte, Spielende bewegen eigene Tokens; offen: `redactEntity` hält versteckte Marker am Server nicht zurück (D56)*
- **[[REQ-215]]** (3, teils, Spielererlebnis) — Tragraster aus Grösse und Stärke — *`Statblock.carryExtra` gerechnet, Grundquadrat aus `carrySquares`; `carryGrid` im Modell, Prototyp (D54). Zonen je Zelle setzbar („Shape & zones“); die Vorgabe nach Spalten kommt noch aus der globalen Einstellung `carryZones`, nicht aus dem Inventarmodul (E-096)*
- **[[REQ-216]]** (3, teils, Spielererlebnis) — Behälter in Behältern — *Ziehstufe die Kette hinauf (`drawStage`), `slotDraw`, Basiszonen `carryZones` und Vorlagen `container:*` (D54). Offen nach E-096: innere Zonen zählen heute absolut (das Langsamere aus Zone und Behälter + 1), nicht vom Platz des Behälters aus*
- **[[REQ-221]]** (3, offen, Kampagne & Sitzungen) — Begegnungen bauen
- **[[REQ-225]]** (3, teils, Spielererlebnis) — Fallenlassen und Verstauen — *„Drop“/„Stow“ am Bogen in der Zeile ihrer Kosten (Einstellung `handActions`), `tier: ground`, Gurt frei in `slotDraw`; `handActions`/`inHand` im Modell (Prototyp, D58). Offen nach E-080 a: Kosten aus dem Modul (`fixed`/`drawPlusOne`), am Platz und im Verdrängen-Dialog*
- **[[REQ-227]]** (3, offen, Regeln & Nachschlagen) — Masse im Fliesstext umrechnen — *umgerechnet werden nur Felder mit `unit` und Angriffszeilen (`convertText`, W2)*
- **[[REQ-229]]** (3, offen, Zugang & Betrieb) — Konten in der Seite verwalten — *nur über `user` auf dem Server; die Kontoliste der Verwaltung steht in der Seite (W3)*
- **[[REQ-242]]** (3, offen, Zugang & Betrieb) — Felder der eigenen Figur sperren — *die eigene Figur verwaltet der Spieler ganz (E-014 d)*
- **[[REQ-253]]** (3, offen, Inhaltsgerüst) — Ebenen und Artikel kopieren — *später; Kopie ohne `overrides`*
- **[[REQ-268]]** (3, teils, Zugang & Betrieb) — Dev-Token aus der Werkbank erzeugen — *Tokens am Konto in `konto/`; aus der Werkbank für andere Konten nicht*
- **[[REQ-271]]** (3, offen, Zugang & Betrieb) — Konflikte bei der Übernahme nebeneinander lösen — *Konflikte werden heute nur gemeldet*
- **[[REQ-274]]** (3, offen, Kreaturen & Figuren) — Charakter- und Kampagnenmanager jederzeit aufrufen
- **[[REQ-283]]** (3, offen, Kampagne & Sitzungen) — Kampagnen-Ladebildschirm
- **[[REQ-285]]** (3, teils, Welt & Lore) — Fraktionspreise — *`discount` nach Rang, `controls`*
- **[[REQ-288]]** (3, teils, Import & Inhalte) — Preise für jeden Gegenstand — *T-139 (`priceNote`) läuft*
- **[[REQ-289]]** (3, offen, Regeln & Nachschlagen) — Homebrew-Regeln erfassen — *wenn das Gerüst steht*
- **[[REQ-291]]** (3, offen, Oberfläche & Navigation) — Leseansicht auf dem Board
- **[[REQ-294]]** (3, teils, Karten) — Token ohne Bild zeigt den Anfangsbuchstaben — *Anfangsbuchstabe ja; Deckname nicht geprüft*
- **[[REQ-295]]** (3, offen, Medien & Assets) — Bild ersetzen als Fassung oder neue Quelle
- **[[REQ-296]]** (3, teils, Medien & Assets) — Bildklassen — *`Asset.kind` (T-119); Übersicht fehlt*
- **[[REQ-297]]** (3, offen, Medien & Assets) — Bilder aus 5e.tools einlesen und verknüpfen
- **[[REQ-300]]** (3, teils, Oberfläche & Navigation) — Gestaltung wie die Bücher — *Pergament in `apps/web`; Design-Lauf offen*
- **[[REQ-308]]** (3, offen, Import & Inhalte) — Obsidian-Vault einlesen — *die alten Importer sind weg (2026-09-20)*
- **[[REQ-314]]** (3, teils, Import & Inhalte) — Regelwerk eines Drittverlags laden — *T-122*
- **[[REQ-329]]** (3, offen, Medien & Assets) — Bilder im Inventar
- **[[REQ-330]]** (3, offen, Medien & Assets) — Inventory image an einen Gegenstand binden
- **[[REQ-332]]** (3, offen, Spielererlebnis) — Beute öffnen und nehmen
- **[[REQ-340]]** (3, offen, Spielererlebnis) — Raster und Zonen eines Trägers in der Maske
- **[[REQ-357]]** (3, teils, Regeln & Nachschlagen) — Regelgraphen wirken am Tisch — *Option Rules from graphs (Campaign.ruleGraphs): der Zugplan sendet leavesReach, attacked, hit/missed, damaged; Reaktionen werden angeboten, die Gelegenheitsattacke kommt aus ihrer Regel. Offen: castsSpell, picksUpObject, turnStart, Folgen mit Wirkung, Fassungen.*

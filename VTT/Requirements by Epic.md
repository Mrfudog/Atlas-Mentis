---
tags: [vtt, requirements, view]
status: derived
updated: 2026-10-14
---

# Requirements by Epic

> [!info] Erzeugt aus den Notizen
> Quelle sind die Story-Notizen in `VTT/Stories/`, die Features in `VTT/Features/`, die Epics in `VTT/Epics/`.
> `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md` schreibt diese Seite neu — von Hand geändert wird die Notiz, nicht die Seite.

Sprung: [[#EP-01 Inhaltsgerüst]] · [[#EP-02 Zugang & Betrieb]] · [[#EP-03 Kreaturen & Figuren]] · [[#EP-04 Spielererlebnis]] · [[#EP-05 Kampagne & Sitzungen]] · [[#EP-06 Welt & Lore]] · [[#EP-07 Regeln & Nachschlagen]] · [[#EP-08 Live-Spiel]] · [[#EP-09 Karten]] · [[#EP-10 Medien & Assets]] · [[#EP-11 Oberfläche & Navigation]] · [[#EP-12 Import & Inhalte]]

## EP-01 Inhaltsgerüst

51 Stories · 169 Punkte · 31 steht · 10 teils · 4 offen · 4 ersetzt · 2 verworfen — [[EP-01 Inhaltsgerüst]]

### F-001 Artikelmodell

Peg, Karten je Art, Kanten, Bezeichner — wie ein Artikel gespeichert wird. — [[F-001 Artikelmodell]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-001]] | Core entity model: entity types, shared property types, typed relations, immutable IDs | – | 1 | 5 | steht |
| [[REQ-002]] | Successor chain: successorId, resolution to head so old links stay valid | – | 1 | 2 | ersetzt |
| [[REQ-010]] | Dimensions: optional, sparsely stored property bundles (Visibility, TemporalValidity, KnowledgeRequirement, Reputation…) | – | 1 | 3 | steht |
| [[REQ-011]] | ContentBlock primitive: text + visibility + knowledge requirement + scope + temporal validity + pack membership | – | 1 | 5 | ersetzt |
| [[REQ-016]] | Term / translation layer: pseudoname key, LocalizedText, fallback chain DE → EN → key | – | 1 | 3 | verworfen |
| [[REQ-019]] | RawContent coexistence: every import keeps its raw form (markdown, OCR, JSON) next to structured data | – | 1 | 2 | verworfen |
| [[REQ-163]] | Opaque IDs: no semantics (pack/type/version) in peg IDs; provenance via source metadata (`source_pack`, `source_version`); copying only as explicit fork with `forkedFrom` | – | 1 | 1 | steht |
| [[REQ-181]] | Ad-hoc fields on a single entity, promotable into the interface definition | – | 2 | 3 | steht |
| [[REQ-182]] | Relation inverse labels in `relation_def`, so one stored edge renders correctly from both ends | – | 2 | 1 | steht |

### F-002 Register

Die Seite /registry: Typen, Felder, Kanten, Listen und Ansichten anlegen und ändern, mit Zählung vorher. — [[F-002 Register]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-230]] | Register in der Seite bearbeiten: die Leitung legt Typen, Felder, Kantenarten und Listen in der Web-Oberfläche an und ändert sie; vorher wird gezählt und gesagt, was eine Änderung im Bestand trifft, und eine Änderung, die gespeicherte Artikel beim nächsten Speichern ungültig machte (Karte ohne Typ, Typ mit Artikeln), lässt die Seite nicht zu | – | 2 | 5 | steht |
| [[REQ-265]] | Register zeigt einen Typ auf einer Fläche | Spielleitung | 2 | 3 | steht |
| [[REQ-260]] | Ausgehende Kanten im Register sehen | Spielleitung | 3 | 1 | steht |
| [[REQ-262]] | Flache Typenlisten | Spielleitung | 3 | 1 | steht |
| [[REQ-263]] | Was eine Einstellung im Register auslöst | Spielleitung | 3 | 1 | steht |
| [[REQ-027]] | Generic template engine & Template Manager UI (generalize hardcoded types) | – | 4 | 13 | steht |

### F-003 Feldformen & Aufzählungen

Was ein Feld halten darf: Formen, Aufzählungszeilen, Spannen, Verweisziele, Vorgaben, freie Sorten. — [[F-003 Feldformen & Aufzählungen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-012]] | Block types: paragraph, readaloud, fact, secret, poem/song/review… extensible list | – | 2 | 2 | steht |
| [[REQ-023]] | Status dimension: idea / planned / used / discarded | – | 2 | 1 | ersetzt |
| [[REQ-258]] | Verweisfeld nennt, welche Artikel es annimmt | Spielleitung | 2 | 2 | teils |
| [[REQ-261]] | Sorte einer Art als freies Feld mit Vorschlägen | Spielleitung | 2 | 1 | steht |
| [[REQ-259]] | Vorgabewerte für Felder | Spielleitung | 3 | 1 | steht |

### F-004 Ebenen & Stapel

Ebenen, Gruppen von Ebenen, Herausgeber, Aufschalten (auch teilweise) und was im Stapel einer Kampagne steht. — [[F-004 Ebenen & Stapel]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-004]] | Layer entity: types system/expansion/world/pack/campaign/override-set, dependsOn, nesting by link with priority | – | 1 | 3 | steht |
| [[REQ-005]] | Entry relation: entity→layer with mode adds/overrides/removes, addedAt/addedBy, optional version pin | – | 1 | 3 | steht |
| [[REQ-006]] | Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system) | – | 1 | 5 | teils |
| [[REQ-100]] | World as scope and layer (members, owns content, activated by campaigns) | – | 1 | 2 | teils |
| [[REQ-044]] | Scope inspector sidebar, slim: effective source layer per block/property | – | 2 | 5 | steht |
| [[REQ-102]] | Contextual article rendering per stack: knowledge, time, scope resolved at read time | – | 2 | 5 | teils |
| [[REQ-244]] | Ebenen gruppieren (Grundregeln, Ergänzungen, Settings, Abenteuer, Unearthed Arcana, 2024, Eigenes …), gruppenweise auf- und zuklappen und aufschalten | – | 2 | 3 | steht |
| [[REQ-245]] | Ebenen beschreiben sich selbst: voller Titel, erklärte Abkürzung, Erscheinungsdatum, Regelstand (2014/2024), Gruppe, Inhalt je Art; Quellenkürzel an Artikeln zeigen überall den vollen Namen | – | 2 | 2 | steht |
| [[REQ-249]] | Ebenen nach Herausgeber und Kategorie: offizielles D&D, Partner-Inhalte, Drittanbieter, Homebrew — dazu die Kategorien wie in 5e.tools (Utilities › Content Blocklist), damit die Auswahl leichtfällt | – | 2 | 3 | teils |
| [[REQ-255]] | Ebenen teilweise aufschalten: aus einem Buch oder Abenteuer nur Regeln/Gegenstände nehmen, nicht dessen Orte, NSC und Begegnungen (Auswahl nach Bereich World/Rules/Story bzw. Art) | – | 2 | 3 | steht |
| [[REQ-007]] | Stack expert settings: layer priority, per-entry pick, disable single override, flatten into independent layer | – | 3 | 5 | offen |
| [[REQ-045]] | Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry) | – | 3 | 8 | offen |
| [[REQ-253]] | Ebenen und Artikel kopieren: eine ganze Ebene oder ausgewählte Artikel daraus in eine andere (eigene) Ebene kopieren, z. B. in der Werkbank | – | 3 | 5 | offen |

### F-005 Fassungen & Varianten

Dieselbe Sache aus einer anderen Quelle (Fassung, Überschreibung) und eine verwandte Sache (Variante); Vergleichsebenen. — [[F-005 Fassungen & Varianten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-008]] | Variant mechanism: copy with variantOf link | – | 1 | 2 | teils |
| [[REQ-009]] | Override mechanism: explicit overrides relation with scope | – | 2 | 3 | steht |
| [[REQ-264]] | Vergleichsebenen der Kampagne | Spielleitung | 2 | 3 | teils |
| [[REQ-310]] | Fassungen am Feld zeigen | Spielleitung | 2 | 3 | steht |
| [[REQ-108]] | Campaign-specific lore divergence via campaign-scoped blocks and overrides | – | 3 | 3 | steht |

### F-006 Ansichten & Anordnung

Overview, Quick, Full, Print, Search und eigene Ansichten; Anordnung am Typ, ohne Code. — [[F-006 Ansichten & Anordnung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-026]] | View config format: mode raw/structured/hybrid, field list, resolution priority per view | – | 1 | 3 | steht |
| [[REQ-256]] | Ansichten ohne Code definieren: global je Ansicht festlegen, welche Felder (nach Typ bzw. Typ.Feld) erscheinen; ein Artikel zeigt davon, was er hat; je Artikelart überschreib- und anpassbar | – | 1 | 8 | steht |
| [[REQ-164]] | Facets (Darstellungsstufen): system-wide set short/description/full/image/token/map/link, reusable across boards, sheets, statblocks, notes; `renderer_def` analogous to `projection_def` | – | 2 | 3 | ersetzt |

### F-007 Verweise & Platzhalter

[[Verweise]] nach Nummer, Rückbezüge, {VAR}-Platzhalter, Regelverweise im Text. — [[F-007 Verweise & Platzhalter]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-013]] | Reference registry & auto-linking: ID-based links, alias matching, auto-link when unambiguous, suggest when ambiguous | – | 1 | 5 | teils |
| [[REQ-174]] | Parameterised rule templates: `{VAR}` placeholders in RuleElement text, bound per reference; resolution order reference → entity → campaign register | – | 2 | 3 | steht |
| [[REQ-014]] | Backlinks view | – | 3 | 2 | steht |
| [[REQ-175]] | Inline rule reference panel: text scanned against RuleElement names and aliases, matches shown as an expandable block in the view | – | 3 | 2 | steht |
| [[REQ-176]] | Similarity suggestions on create: fuzzy name/text matching proposes existing entities before a duplicate is made; promote-to-reference in one action | – | 3 | 3 | teils |

### F-008 Kanten verstehen

Was eine Kante bedeutet und bewirkt; Typdiagramm und Graph. — [[F-008 Kanten verstehen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-257]] | Kanten verständlich: zu jeder Kantenart steht, was sie bedeutet und was sie bewirkt (Sichtbarkeit, Stapel, Werte der Figur, nur Anzeige) — in der Auswahl, am Artikel und im Register, mit Vorschau vor dem Anlegen | – | 2 | 5 | steht |
| [[REQ-015]] | Graph view | – | 4 | 5 | offen |

### F-009 Verlauf & gleichzeitiges Schreiben

Änderungsverlauf, Revisionen, nichts still überschreiben. — [[F-009 Verlauf & gleichzeitiges Schreiben]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-003]] | Change chain: every change as entry (who/when/what) along the version chain, git-log style | – | 1 | 3 | teils |
| [[REQ-191]] | Fail-closed persistence: a failed load or migration must never be overwritten by a later autosave; the unreadable state is preserved and downloadable | – | 1 | 2 | steht |
| [[REQ-192]] | Optimistic concurrency for non-realtime edits: per-entity revision check; the second writer is rejected with a merge prompt rather than silently winning | – | 2 | 3 | steht |

## EP-02 Zugang & Betrieb

37 Stories · 114 Punkte · 22 steht · 5 teils · 7 offen · 1 ersetzt · 2 verworfen — [[EP-02 Zugang & Betrieb]]

### F-010 Anmeldung & Konten

Passwort je Konto, Einladungen, Kontoverwaltung in der Seite, Demo. — [[F-010 Anmeldung & Konten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-031]] | Authentication: password hash check behind an auth interface | – | 1 | 2 | steht |
| [[REQ-033]] | User accounts & profile | – | 1 | 2 | steht |
| [[REQ-034]] | Simplest onboarding: GM-created accounts or plain invite link, whichever is cheaper | – | 2 | 2 | steht |
| [[REQ-229]] | Konten in der Oberfläche verwalten: sperren und entsperren und die Verwaltung (`is_admin`) vergeben, ohne Kommandozeile | – | 3 | 2 | offen |
| [[REQ-032]] | Nextcloud / OIDC SSO behind the auth interface | – | 4 | 5 | verworfen |
| [[REQ-228]] | Verlorene Einladung neu ausgeben: eine offene Einladung lässt sich in einem Schritt durch eine neue mit denselben Angaben (Kampagne, Rolle, Figur, Nutzungen, Ablauf) ersetzen | – | 4 | 1 | offen |
| [[REQ-266]] | Demo-Zugang | Verwaltung | 5 | 3 | offen |

### F-011 Rollen je Kampagne

gm, co-gm, player, spectator am Konto je Kampagne; Verwaltung der Installation. — [[F-011 Rollen je Kampagne]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-035]] | Membership triples: user + scope (campaign/world/layer) + role | – | 1 | 3 | steht |
| [[REQ-036]] | Roles GM / Player (Admin global) | – | 1 | 1 | steht |
| [[REQ-037]] | Roles Co-GM / Spectator | – | 3 | 2 | steht |

### F-012 Sichtbarkeit & Wissen

Wer einen Artikel sieht (audience, revealedTo, hiddenFrom) und welche Felder darin (Information, Wissen, Deckname). — [[F-012 Sichtbarkeit & Wissen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-038]] | Visibility evaluation, simple: gm_only vs campaign | – | 1 | 2 | steht |
| [[REQ-040]] | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | – | 2 | 3 | steht |
| [[REQ-156]] | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | – | 2 | 2 | verworfen |
| [[REQ-177]] | Field-level knowledge gating: grant individual components or fields of an entity, not only ContentBlocks | – | 2 | 3 | steht |
| [[REQ-203]] | Fraktionen mit Rängen: `Faction.ranks` als Leiter (niedrigster zuerst), der Rang eines Mitglieds an der Kante `memberOf`, und eine Wissenszuteilung an die Fraktion darf einen Mindestrang nennen — was der Zirkel weiss, weiss der Novize noch nicht | – | 2 | 2 | steht |
| [[REQ-039]] | Visibility evaluation, full: scope, allowed/denied roles, knowledgeTags, requiresTags, sharedUsers | – | 3 | 8 | ersetzt |
| [[REQ-059]] | Creature knowledge facts: gated ContentBlocks on type / species / faction | – | 3 | 3 | steht |
| [[REQ-178]] | Cover names: an entity may carry a player-facing alias shown while its identity is ungranted | – | 3 | 1 | steht |
| [[REQ-179]] | Known-unknowns disclosure: a gated view may reveal the count of withheld facts without revealing them | – | 4 | 1 | steht |

### F-013 Schreibrechte & Freigabe

Wer was schreibt (je Ebene, eigene Artikel), Status ready als Freigabe, gesperrte Felder. — [[F-013 Schreibrechte & Freigabe]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-041]] | Per-document edit permissions: owner, GM-default (overridable), co-editors / wardship / open | – | 2 | 3 | teils |
| [[REQ-237]] | Spielende legen Artikel jeder Art an (z. B. Figur, Hintergrund); „ready“ setzt nur die Leitung. Spielende sehen nur fertige Artikel und ihre eigenen; ändert eine Spielerin einen fertigen Artikel, fällt der Status zurück und für alle anderen gilt der letzte fertige Stand weiter | – | 2 | 5 | steht |
| [[REQ-242]] | Spielercharakter: die Leitung kann einzelne Felder oder Kanten für den Spieler sperren oder ihre Änderung freigabepflichtig machen (z. B. Attributswerte, Klasse), während der Rest frei bleibt | – | 3 | 5 | offen |
| [[REQ-042]] | Field-group edit granularity (e.g. vitals editable, abilities locked) | – | 4 | 5 | offen |

### F-014 Sicht eines Spielers

Die Leitung sieht die Seite, wie ein bestimmtes Konto sie sieht. — [[F-014 Sicht eines Spielers]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-241]] | Als Spielleitung die Sicht eines Spielers einnehmen: dieselben Artikel, Felder und Entwürfe sehen wie dieses Konto, um Probleme zu erkennen und zu helfen | – | 1 | 5 | steht |

### F-015 API-Tokens & Werkzeugzugang

Tokens am Konto für Skripte und Claude-Sitzungen. — [[F-015 API-Tokens & Werkzeugzugang]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-234]] | Werkzeugzugang: ein Konto vergibt API-Tokens (`read`/`write`, mit Ablauf, nur als Hash gespeichert); ein Token sieht und darf nie mehr als sein Konto | – | 3 | 2 | steht |
| [[REQ-268]] | Dev-Token aus der Werkbank erzeugen | Verwaltung | 3 | 1 | teils |

### F-016 Werkbank

Prüfungen über den Bestand, Massenänderungen mit Vorschau und Rückgängig (/werkbank). — [[F-016 Werkbank]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-088]] | Bulk actions: knowledge / permission assignment | – | 3 | 3 | teils |
| [[REQ-235]] | Werkbank: erweiterbare Prüfungen über den ganzen Bestand und Massenänderungen mit Vorschau, Protokoll und Rückgängig; mehrere Artikel löschen nur mit ausdrücklicher Bestätigung | – | 3 | 5 | steht |

### F-017 Ausrollen & Sicherung

CI/CD nach Hetzner, dev und prod, Sicherungen, Spiegelung, Netz. — [[F-017 Ausrollen & Sicherung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-154]] | Deployment: container(s) on NAS, reverse proxy, TLS, remote player access | – | 1 | 3 | steht |
| [[REQ-155]] | Backups of database and app-managed assets | – | 2 | 2 | steht |
| [[REQ-269]] | Ankündigen, wann produktiv gearbeitet werden kann | Verwaltung | 2 | 1 | teils |
| [[REQ-199]] | Produktionsdaten nach preprod spiegeln: regelmässiger Abzug aus der Prod-Datenbank in die Testinstanz, damit gegen echte Inhalte getestet wird | – | 3 | 3 | steht |
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
| [[REQ-246]] | Navigation ohne Einfrieren: ein Seitenwechsel antwortet in unter einer Sekunde, auch nach längerer Pause und mit dem ganzen 5e.tools-Bestand; werden Daten geladen, sagt ein Banner das (statt stillzustehen) | – | 1 | 5 | steht |
| [[REQ-232]] | Listen rechnet der Server: Blättern, Suchen, Filtern und Auswahlen über den gesiebten Bestand am Server, die Oberfläche hält keinen Bestand — ein Blatt unter 100 KB, Blättern und Suchen unter 100 ms, ein Artikel ohne Warten auf eine Liste | – | 2 | 5 | steht |

## EP-03 Kreaturen & Figuren

27 Stories · 116 Punkte · 16 steht · 1 teils · 9 offen · 1 ersetzt — [[EP-03 Kreaturen & Figuren]]

### F-020 Kreatur

Die Artikelart Creature mit kind, Beziehungen, Begleitern. — [[F-020 Kreatur]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-046]] | Creature / Statblock split with PC and NPC specializations | – | 1 | 3 | steht |
| [[REQ-050]] | Simple creature viewer: social / description / combat sections | – | 2 | 3 | steht |
| [[REQ-060]] | Companions / summons as regular creatures via companionOf + overrides | – | 3 | 2 | teils |
| [[REQ-105]] | NPC directory as filtered view over creatures with relations | – | 3 | 2 | steht |

### F-021 Statblock

Die Zahlen einer Kreatur, aus Regeln zusammengesetzt; Vorlage und Instanz. — [[F-021 Statblock]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-272]] | Statblock als Instanz einer Vorlage | Spielleitung | 1 | 3 | steht |
| [[REQ-053]] | Statblock as composition of RuleElement references (traits, feats, actions) | – | 2 | 5 | steht |
| [[REQ-054]] | Fightingtype field (MCDM roles) on statblock | – | 2 | 1 | steht |
| [[REQ-052]] | Detailed statblock viewer | – | 3 | 3 | steht |
| [[REQ-055]] | Inline trait reuse & variant creation while typing | – | 3 | 3 | offen |
| [[REQ-058]] | Monster scaling | – | 5 | 5 | offen |
| [[REQ-062]] | Multi-system statblock extension point (system reference on composition) | – | 5 | 8 | offen |

### F-022 Schnellanlage

Kreatur und Statblock in einem Schritt anlegen. — [[F-022 Schnellanlage]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-048]] | Minimal edit form for core creature fields | – | 2 | 3 | steht |
| [[REQ-049]] | Quick add: name-only NPC or statblock-only mob in one field | – | 2 | 2 | steht |

### F-023 Charakterbogen

Der Bogen einer Figur: Allgemein, Kampf, Zauber, Freispiel, schnelle Änderungen. — [[F-023 Charakterbogen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-051]] | Quick changes: HP, temp HP, conditions, rest, inspiration | – | 2 | 3 | steht |
| [[REQ-063]] | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | – | 2 | 5 | steht |
| [[REQ-066]] | Character sheet: Combat tab (initiative, actions, companions) | – | 3 | 5 | steht |
| [[REQ-067]] | Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) | – | 3 | 5 | offen |
| [[REQ-068]] | Character sheet: Freeplay tab | – | 4 | 3 | offen |
| [[REQ-073]] | Custom / reorderable sheet layout | – | 4 | 5 | ersetzt |

### F-024 Charaktermanager

Figur geführt erstellen und steigern: Klasse, Herkunft, Hintergrund, Wahlen, Attribute, Ausrüstung, Sprachen. — [[F-024 Charaktermanager]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-238]] | Charaktererstellung aus den Artikeln: Klasse, Herkunft (Ancestry) und Hintergrund wählen und ihre Entscheidungen treffen; Schritte und Wahlmöglichkeiten kommen aus den Artikeln, nicht aus Code — eine Änderung am Artikel wirkt sofort | – | 1 | 13 | steht |
| [[REQ-251]] | Sprachen der Kampagne: die Kampagne nennt die sinnvollen/möglichen Sprachen; Sprachwahlen in der Charaktererstellung bieten genau diese an | – | 1 | 2 | steht |
| [[REQ-250]] | Startausrüstung je Kampagne einstellbar: nach Regeln (Klasse/Hintergrund), Gold (fest oder gewürfelt) oder frei mit eigenen Grenzen (Goldbudget, höchstens N magische Gegenstände je Seltenheit u. ä.) | – | 2 | 5 | steht |
| [[REQ-273]] | Eigene Verfahren für Attributswerte | Spielleitung | 2 | 2 | steht |
| [[REQ-274]] | Charakter- und Kampagnenmanager jederzeit aufrufen | Spieler | 3 | 5 | offen |
| [[REQ-056]] | Creature builder with suggestions (origin + fightingtype filter, grants applied via effects) | – | 4 | 13 | offen |
| [[REQ-057]] | Point-buy ability setting | – | 4 | 2 | offen |
| [[REQ-222]] | Stufenaufstieg: Schritte aus Klassen- und Unterklassentabellen (TP, Attributsverbesserung oder Talent, Zauber), Folgewerte gerechnet | – | 4 | 5 | offen |

## EP-04 Spielererlebnis

21 Stories · 54 Punkte · 8 steht · 5 teils · 8 offen — [[EP-04 Spielererlebnis]]

### F-025 Spieleransicht & Telefon

Die Seite aus Sicht der Spielenden, auch am Telefon. — [[F-025 Spieleransicht & Telefon]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-069]] | Phone-first responsive layout for all player-facing views | – | 1 | 3 | teils |
| [[REQ-311]] | Spieleransicht mit der eigenen Figur im Fokus | Spieler | 2 | 5 | teils |
| [[REQ-074]] | Quicklinks: campaign, quests, party, session | – | 3 | 1 | teils |
| [[REQ-194]] | Mobile navigation: the user chooses which entries occupy the phone bottom bar | – | 4 | 1 | offen |

### F-026 Inventar

Liste und Raster, Behälter und Zonen, Ausrüstungsfigur, Ziehen und Verstauen, Gruppeninventar, Gegenstände als Instanz. — [[F-026 Inventar]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-064]] | Inventory as list: coins / attuned / worn / carried / stored / deeds | – | 2 | 3 | steht |
| [[REQ-275]] | Erhaltene Gegenstände als Instanz | Spieler | 2 | 3 | teils |
| [[REQ-183]] | Party-owned inventory as a shared container distinct from character inventories | – | 3 | 2 | steht |
| [[REQ-215]] | Tragraster aus Grösse und Statblock: ein Grundquadrat nach Grösse (Tiny 3 … Large 6) und ein Zusatzquadrat in der Grösse des Stärkemodifikators (+1 … +5) aus dem Statblock des Trägers — beim Lesen gerechnet, nie eingetippt | – | 3 | 2 | steht |
| [[REQ-216]] | Behälter in Behältern: jeder Behälter gibt eine Ziehstufe dazu, ausgehend davon, wo er selbst liegt; die Basiszonen kommen aus dem Blatt und sind je Behälter änderbar | – | 3 | 2 | steht |
| [[REQ-217]] | Ziehen am Bogen: unter Aktion, Bonusaktion usw. je ein Eintrag „Ziehen“; ein Klick zeigt, was sich mit dieser Aktion herausnehmen lässt, mit Dauer | – | 3 | 2 | steht |
| [[REQ-225]] | Fallenlassen ist eine freie Aktion, Verstauen eine Bonusaktion, egal wohin; der Gurt ist eine freie Aktion | – | 3 | 1 | steht |
| [[REQ-065]] | Tile-based visual inventory (alternative view over same data) | – | 4 | 8 | steht |
| [[REQ-214]] | Ausrüstungsfigur nach dem Inventarblatt: Figur je Kreatur wählbar (männlich, weiblich, neutral) und dort gespeichert; Plätze Kopf, Schulter, Torso, rechte und linke Hand, Beine, Stiefel, Gurt mit zwei Holstern, Ringe je Hand, Halskette | – | 4 | 2 | steht |
| [[REQ-276]] | Unverstaute Gegenstände gelten als liegengelassen | Spielleitung | 4 | 2 | offen |
| [[REQ-277]] | Gegenstände mit Form spiegeln | Spieler | 4 | 1 | offen |

### F-027 Eigene Inhalte der Spielenden

Notizen, Ziele, Lore-Artikel, die Spielende selbst anlegen. — [[F-027 Eigene Inhalte der Spielenden]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-072]] | Player notes as owned documents | – | 2 | 2 | offen |
| [[REQ-083]] | Player-created quests and personal goals | – | 3 | 1 | offen |
| [[REQ-109]] | Player-authored ContentBlocks with per-view block-type whitelist | – | 3 | 3 | teils |

### F-028 Chat

Fäden zwischen Leitung und Spielenden, daraus Kampagneninhalt. — [[F-028 Chat]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-202]] | Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit | – | 2 | 2 | offen |
| [[REQ-200]] | Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung | – | 3 | 5 | offen |
| [[REQ-201]] | Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle | – | 3 | 3 | offen |

## EP-05 Kampagne & Sitzungen

31 Stories · 106 Punkte · 17 steht · 3 teils · 11 offen — [[EP-05 Kampagne & Sitzungen]]

### F-029 Kampagne

Die Kampagne als Wurzel: Einstellungen, Kampagnenwerte, Anlegen mit Dialog, Bereiche als Seiten. — [[F-029 Kampagne]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-075]] | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | – | 1 | 3 | steht |
| [[REQ-278]] | Bereiche als eigene Seiten | Spielleitung | 1 | 2 | steht |
| [[REQ-043]] | Campaign configuration store: key-value, each area interprets its keys | – | 2 | 2 | steht |
| [[REQ-236]] | Kampagne anlegen mit Dialog: Name, aufgeschaltete Ebenen (Liste mit Häkchen und Reihenfolge, vorhandene vorausgewählt), eigene Kampagnenebene, Leitung | – | 2 | 3 | offen |
| [[REQ-279]] | Kampagnenwerte pflegen und in Texten nutzen | Spielleitung | 2 | 2 | teils |

### F-030 Bereich Story

Arcs, Kapitel, Quests, Szenen, Fäden — die Geschichte der Kampagne. — [[F-030 Bereich Story]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-076]] | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | – | 1 | 3 | steht |
| [[REQ-080]] | Readaloud blocks unlocking for players after session (time/event-based grant) | – | 3 | 2 | offen |
| [[REQ-082]] | Quests with tasks, rewards, restrictions; player-facing quest board with gated GM parts | – | 3 | 3 | steht |
| [[REQ-180]] | Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in | – | 3 | 3 | offen |

### F-031 Sitzungen & Vorbereitung

Sitzungen, Vorbereitungsseite, Unfertiges und Todos, Schnellerfassung, Sitzungsansicht. — [[F-031 Sitzungen & Vorbereitung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-077]] | Session documents with planned vs occurred encounters and reports | – | 2 | 3 | steht |
| [[REQ-078]] | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | – | 2 | 5 | steht |
| [[REQ-079]] | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | – | 2 | 3 | teils |
| [[REQ-282]] | Sitzungsansicht für das Spiel | Spielleitung | 2 | 3 | offen |
| [[REQ-084]] | Ideas inbox per campaign/player and clean vs planning view toggle | – | 3 | 3 | steht |
| [[REQ-188]] | Cross-type "unfinished" overview: everything at status idea/planned across all interfaces, with jump-to and bulk status change | – | 3 | 2 | steht |
| [[REQ-189]] | Aggregated todo list across containers and entities (campaign, arc, session, quest, NPC) | – | 3 | 2 | steht |
| [[REQ-190]] | Quick capture during play: one field that files a seed, todo or idea against the current session without leaving the view | – | 3 | 2 | steht |
| [[REQ-280]] | Umschalter Vorbereitung und Spiel | Spielleitung | 4 | 2 | offen |

### F-032 Begegnungen

Begegnungen bauen und vorbereiten, Begegnungstabellen, Weltzustand zwischen Sitzungen. — [[F-032 Begegnungen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-085]] | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | – | 2 | 3 | steht |
| [[REQ-172]] | Weighted encounter tables per region, with per-location type constraints and safety states that restrict the pool | – | 3 | 3 | steht |
| [[REQ-221]] | Begegnungsbau: Schwierigkeit aus den XP-Schwellen der Gruppe mit Multiplikator nach Anzahl (2014), Kreaturen aus dem Kompendium, dann auf die Karte setzen und Initiative starten | – | 3 | 3 | offen |
| [[REQ-173]] | World-state decay between sessions: roll to degrade secured locations, weighted by adjacency to faction territory | – | 4 | 3 | offen |

### F-033 Abenteuer übernehmen

Vorgefertigte Abenteuer als Ebene, Kapitel und Szenen in die eigene Geschichte holen. — [[F-033 Abenteuer übernehmen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-240]] | Vorgefertigte Abenteuer aus 5e.tools: je Abenteuer eine Ebene mit Kapiteln, Abschnitten, Begegnungen, Karten und NSC als Artikeln; die Leitung übernimmt sie in die eigene Geschichte und passt sie an, ohne das Original zu verlieren | – | 2 | 13 | steht |
| [[REQ-252]] | Abenteuer modular: Kapitel als Arcs, Begegnungen und Karten als eigene Szenen; einzelne Vorlesetexte oder ganze Kapitel in die eigene Kampagne übernehmen | – | 2 | 5 | steht |

### F-034 Party

Die Figurengruppe einer Kampagne mit ihrer Übersicht. — [[F-034 Party]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-281]] | Eine Party je Kampagne | Spielleitung | 1 | 2 | steht |
| [[REQ-086]] | Party view: passive perception, feats, inventory overview | – | 3 | 3 | teils |
| [[REQ-122]] | Widget: party overview | – | 3 | 2 | steht |

### F-035 Ladebildschirm-Board

Ein öffentliches Board je Kampagne mit Widgets, das alle anpassen. — [[F-035 Ladebildschirm-Board]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-283]] | Kampagnen-Ladebildschirm | Spieler | 3 | 3 | offen |

### F-036 Sitzungsmitschnitt

Audio aufnehmen, transkribieren, Recap-Entwurf. — [[F-036 Sitzungsmitschnitt]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-196]] | Sitzungsmitschnitt: Audio einer Sitzung aufnehmen oder eine fertige Aufnahme anhängen, als Asset am Sitzungs-Container, mit Startzeit und Kapitelmarken | – | 4 | 5 | offen |
| [[REQ-197]] | Transkription und Recap-Entwurf: Mitschnitt transkribieren, am Sitzungsverlauf ausrichten und daraus einen Recap-Entwurf erzeugen, den die SL bearbeitet | – | 4 | 8 | offen |
| [[REQ-198]] | Sprecherzuordnung im Transkript: Abschnitte einer Figur oder der SL zuordnen, damit „was hat meine Figur mitbekommen“ beantwortbar wird | – | 5 | 5 | offen |

## EP-06 Welt & Lore

17 Stories · 63 Punkte · 8 steht · 1 teils · 6 offen · 2 ersetzt — [[EP-06 Welt & Lore]]

### F-037 Bereich World

Orte, Fraktionen, Gottheiten, Lore-Artikel, Welt als Ebene, Kampagnenabweichungen. — [[F-037 Bereich World]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-101]] | Lore articles: categories, composed of ContentBlocks | – | 2 | 3 | steht |
| [[REQ-103]] | Locations: hierarchy via parent, type, biome | – | 2 | 2 | steht |
| [[REQ-104]] | Factions: type/subtype taxonomy, relations | – | 2 | 2 | steht |
| [[REQ-107]] | Pantheons / deities as article subtype | – | 4 | 1 | offen |
| [[REQ-110]] | Bibliothek von Tan'Jit: illustrated navigation presentation layer over articles | – | 5 | 8 | offen |

### F-038 Kalender & Zeitleisten

Weltdatum, Kalender an der Welt, Zeitleisten der Weltgeschichte und der Kampagne. — [[F-038 Kalender & Zeitleisten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-024]] | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | – | 1 | 2 | steht |
| [[REQ-025]] | CalendarSystem definition: months, eras, moons, configurable per world/system | – | 3 | 5 | offen |
| [[REQ-106]] | Events & timelines sorted by WorldDate | – | 3 | 3 | steht |
| [[REQ-220]] | Zeitleisten der Weltgeschichte: mehrere Spuren (ein Krieg, eine Dynastie, Zeitalter) neben der Kampagnenzeitleiste; ein Ereignis mit Spanne enthält seine Ereignisse, und die Kampagne ist eine Spur unter ihnen | – | 3 | 3 | steht |
| [[REQ-087]] | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | – | 5 | 13 | offen |

### F-039 Beziehungen & Ruf

Beziehungen als Kanten mit Marken. — [[F-039 Beziehungen & Ruf]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-030]] | Reputation hooks: weighted tags on relations, propagation rule slot reserved | – | 2 | 1 | ersetzt |
| [[REQ-061]] | Creature relations (creature ↔ creature / faction) with relation type | – | 2 | 2 | steht |
| [[REQ-081]] | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | – | 4 | 8 | ersetzt |

### F-040 Läden & Wirtschaft

Läden mit Waren und Preisen, Fraktionspreise, andere Währungen. — [[F-040 Läden & Wirtschaft]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-284]] | Läden mit Waren und Preisen | Spielleitung | 2 | 3 | steht |
| [[REQ-285]] | Fraktionspreise | Spielleitung | 3 | 2 | teils |
| [[REQ-185]] | Non-coin economies: barter and alternative currency ladders per region | – | 5 | 2 | offen |

### F-041 Namensgenerator

Namen für Figuren und Orte erzeugen. — [[F-041 Namensgenerator]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-254]] | Namensgenerator: Namen für NSC, Orte usw. erzeugen (z. B. aus den Namenstabellen der Abstammungen/Kulturen), übernehmbar beim Anlegen | – | 4 | 3 | offen |

## EP-07 Regeln & Nachschlagen

23 Stories · 103 Punkte · 10 steht · 1 teils · 12 offen — [[EP-07 Regeln & Nachschlagen]]

### F-042 Bereich Rules & Kompendium

Regelartikel, Nachschlagen in Sekunden, Merkzettel, Zustände. — [[F-042 Bereich Rules & Kompendium]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-089]] | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | – | 1 | 2 | steht |
| [[REQ-091]] | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | – | 2 | 5 | steht |
| [[REQ-094]] | Entity ↔ rule attachment as layer-scoped relation | – | 2 | 3 | steht |
| [[REQ-098]] | Sub-5-second rule lookup during play | – | 2 | 2 | steht |
| [[REQ-313]] | Zustände als Artikel | Spielleitung | 2 | 3 | teils |
| [[REQ-099]] | Pinnable rules: bookmark object (user + context + rule) | – | 3 | 1 | steht |

### F-043 Bücher & Leseansicht

Eine Ebene als Buch lesen, Kapitel aus Teilen. — [[F-043 Bücher & Leseansicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-247]] | Leseansicht für Bücher und Abenteuer: eine Ebene als Buch lesen — Inhaltsverzeichnis, Kapitel in Reihenfolge, eingebettete Artikel (Zauber, Monster, Tabellen) als Verweise bzw. Karten, Lesestand gemerkt | – | 2 | 8 | steht |

### F-044 Klassen

Klassenansicht mit Stufentabelle und Unterklassen. — [[F-044 Klassen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-231]] | Klassenansicht wie 5e.tools: Stufentabelle (Übungsbonus, Merkmale, Spalten der Klasse und gewählter Unterklassen), Merkmale je Stufe ausgeschrieben, optionale Merkmale und Varianten zuschaltbar, Unterklassen nach Name und Quelle filtern und mehrere nebeneinander vergleichen (am Telefon untereinander) | – | 3 | 3 | steht |

### F-045 Zauber

Zauber als Artikel, Zauberlisten. — [[F-045 Zauber]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-092]] | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | – | 2 | 3 | offen |
| [[REQ-097]] | Spell lists as relations (class ↔ spell) | – | 3 | 2 | offen |

### F-046 Regelauswertung

Effekte, Bedingungen und Wechselwirkungen von Regeln auswerten. — [[F-046 Regelauswertung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-018]] | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | – | 1 | 2 | offen |
| [[REQ-017]] | Term engine bindings: system-specific semantic evaluation of rule terms | – | 4 | 5 | offen |
| [[REQ-095]] | Effects interpreter for grants (first consumer: creature builder) | – | 4 | 8 | offen |
| [[REQ-290]] | Wechselwirkungen von Regeln auswerten | Spielleitung | 4 | 8 | offen |
| [[REQ-093]] | Rule engine per system evaluating rules against entity data (constraints, terms) | – | 5 | 13 | offen |
| [[REQ-096]] | Constraint interpreter (first consumer: settlement / building validation) | – | 5 | 8 | offen |

### F-047 Handwerk

Rezepte, Material, Fortschritt, Blaupausen lernen. — [[F-047 Handwerk]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-218]] | Blaupausen werden gelernt: alle Rezepte sind sichtbar, ungelernte mit „muss noch gelernt werden“ (ohne festen Fundort); Filter „kann der Charakter“ und „alle“, „machbar“ und „fast“, nach Material und nach Beruf | – | 3 | 2 | steht |
| [[REQ-219]] | Material wird beim Start an den Vorgang gebunden: es verlässt den Vorrat und kann nicht doppelt oder anderweitig gebraucht werden; was beim Misslingen zurückkommt, sagt `Recipe.onFailure` | – | 3 | 2 | steht |
| [[REQ-184]] | Crafting: recipes with material inputs, skill checks and DC, time, and output; consumption on completion | – | 4 | 5 | steht |

### F-048 Regelsysteme & Module

Regelsysteme als Behälter mit Optionen je Kampagne; Homebrew-Regeln; Rahmen wie Taverne. — [[F-048 Regelsysteme & Module]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-287]] | Regelsysteme als Behälter mit Optionen | Spielleitung | 2 | 8 | offen |
| [[REQ-289]] | Homebrew-Regeln erfassen | Spielleitung | 3 | 3 | offen |
| [[REQ-223]] | Regelsysteme als Rahmen (Taverne, Alley, Kanalisation): ein Ort, seine Kennzahlen, ein Wochenwurf und ein Protokoll | – | 4 | 5 | offen |

### F-049 Masse & Einheiten

Masse beim Lesen umrechnen, auch im Fliesstext. — [[F-049 Masse & Einheiten]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-227]] | Masse im Fliesstext umrechnen: Fuss und Meilen in Regeltexten („within 120 feet“) nach der Einstellung `units` zeigen, beim Lesen gerechnet, gespeichert bleibt der Wortlaut | – | 3 | 2 | offen |

## EP-08 Live-Spiel

28 Stories · 98 Punkte · 14 steht · 6 teils · 7 offen · 1 ersetzt — [[EP-08 Live-Spiel]]

### F-050 Spielleiter-Schirm

Bereich Play: der Schirm mit seinen Boards über mehrere Fenster, Tischanzeige. — [[F-050 Spielleiter-Schirm]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-187]] | Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts | – | 3 | 2 | offen |
| [[REQ-204]] | Spielleiter-Schirm je Kampagne: Fenster (mehrere Bildschirme als Browser-Reiter), darin Plätze, die ein Board oder ein Werkzeug zeigen; zuklappbar, umstellbar, zwischen Fenstern verschiebbar | – | 3 | 5 | offen |
| [[REQ-205]] | Ein Board je Geschichtsartikel (Kampagne, Kapitel, Sitzung, nicht Szene) und Regel-Boards; der Schirm schaltet zwischen ihnen, die Artikelansicht filtert nach Artikeln aus den offenen Boards | – | 3 | 3 | teils |

### F-051 Initiative

Initiative für Leitung und Spielende, Zustände mit Dauer, Anzeige auf der Karte. — [[F-051 Initiative]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-115]] | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | – | 2 | 5 | steht |
| [[REQ-211]] | Initiative wie Improved Initiative: je Zeile Initiative, RK, TP und Zustände, aus der Zeile der Statblock | – | 2 | 3 | steht |
| [[REQ-212]] | Zustände und Notizen mit Dauer: Anzahl Runden, Anker (wessen Zug) und Zeitpunkt (Anfang oder Ende dieses Zuges); eine Notiz ist ein freier Text mit derselben Dauer | – | 2 | 2 | steht |
| [[REQ-128]] | Combat player view: own initiative, conditions, health comments | – | 3 | 3 | teils |
| [[REQ-213]] | Initiative der Spielenden: die eigene Reihenfolge und jede Kreatur, die aufgedeckt oder schon beteiligt ist; nicht erkannte Kreaturen mit Decknamen, TP von Gegnern als Wort | – | 3 | 2 | steht |
| [[REQ-226]] | In der ersten Runde erscheinen Gegner in der Initiative der Spielenden erst, wenn sie an der Reihe sind; ab der zweiten Runde stehen die bereits gezeigten fest | – | 3 | 1 | steht |
| [[REQ-144]] | Initiative indicator on battlemap (current / next) | – | 4 | 2 | steht |

### F-052 Sitzungszustand & Live-Kanal

Was gerade läuft, steht an der Sitzung und kommt live zu allen; Protokoll und Statistik. — [[F-052 Sitzungszustand & Live-Kanal]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-116]] | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | – | 2 | 8 | steht |
| [[REQ-117]] | Stewardship: write permission on a state object per user, GM override configurable | – | 3 | 3 | steht |
| [[REQ-120]] | Play log: persist state events (actor, target, delta) | – | 3 | 3 | teils |
| [[REQ-121]] | Statistics widget: kills, damage per character, monsters faced, records | – | 4 | 3 | offen |

### F-053 Würfel

Würfeln für sich und für alle, mit Protokoll. — [[F-053 Würfel]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-070]] | Local dice roller (selector, modifiers, results) | – | 2 | 2 | steht |
| [[REQ-071]] | Shared rolls & roll log per session | – | 4 | 3 | steht |

### F-054 Werkzeuge am Tisch

Widgets: Notizen, Schnellanlage, Begegnung, Timer, Tabellen, Musik, Fragen. — [[F-054 Werkzeuge am Tisch]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-112]] | Widget: reference box holding multiple open articles with inner tabs | – | 2 | 3 | ersetzt |
| [[REQ-113]] | Widget: notes | – | 2 | 2 | offen |
| [[REQ-114]] | Widget: quick-create (creates entries in the campaign layer inline) | – | 2 | 3 | teils |
| [[REQ-292]] | Neuen Artikel aus einer Auswahl anlegen | Spielleitung | 2 | 2 | teils |
| [[REQ-118]] | Widget: encounter runner — instantiate participants, roll random entries, raw statblocks trackable | – | 3 | 5 | steht |
| [[REQ-123]] | Widget: timers | – | 3 | 1 | offen |
| [[REQ-124]] | Widget: quest board | – | 3 | 2 | steht |
| [[REQ-125]] | Widget: random tables & generators (names, shops, loot, cities) | – | 3 | 5 | steht |
| [[REQ-186]] | Nested loot tables: a table entry may reference another table, with cycle protection | – | 3 | 2 | steht |
| [[REQ-126]] | Widget: sound — embed/link external tool, native now-playing state only | – | 4 | 2 | teils |
| [[REQ-127]] | Native soundboard / music engine | – | 5 | 13 | offen |
| [[REQ-129]] | Chatbot: rules Q&A, facts, quick edit | – | 5 | 8 | offen |

## EP-09 Karten

28 Stories · 124 Punkte · 18 steht · 6 teils · 4 offen — [[EP-09 Karten]]

### F-055 Karte & Kartenebenen

Karte mit Bild, Gitter, Massstab; Unterkarten zum Hineinzoomen. — [[F-055 Karte & Kartenebenen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-130]] | Map entity: image asset, scale, grid config (size, offset, square/hex), link to Location | – | 3 | 2 | steht |
| [[REQ-131]] | Nested maps: parent + anchor region, zoom-through transitions world → region → city → district → battlemap | – | 3 | 8 | steht |
| [[REQ-132]] | Level lock: pin current map level while zooming | – | 3 | 1 | offen |
| [[REQ-293]] | Ladeanzeige für Kartenbilder | Spielleitung | 3 | 1 | steht |
| [[REQ-138]] | Map tiling for smooth zoom (derived asset) | – | 4 | 5 | steht |

### F-056 Tokens & Marker

Marker, Kulisse, Spiel-Tokens, Gruppen-Token, Grösse. — [[F-056 Tokens & Marker]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-133]] | Static tokens: reference markers linked to entities (pin opens article) | – | 3 | 3 | steht |
| [[REQ-135]] | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | – | 3 | 5 | teils |
| [[REQ-136]] | Party and quest markers on region maps (campaign-scoped play tokens) | – | 3 | 2 | steht |
| [[REQ-224]] | Kreaturen nehmen auf der Karte Felder nach ihrer Grösse ein (Regeln 2014): Tiny, Small, Medium, Large 2 × 2, Huge 3 × 3, Gargantuan 4 × 4; Bewegung, Wege, Sicht und Reichweite rechnen mit dem ganzen Platz | – | 3 | 3 | steht |
| [[REQ-294]] | Token ohne Bild zeigt den Anfangsbuchstaben | Spielleitung | 3 | 1 | teils |
| [[REQ-134]] | Static tokens: scenery / props as part of prepared map state | – | 4 | 3 | steht |

### F-057 Nebel, Licht & Sicht

Aufdecken, Licht und Sichtlinien. — [[F-057 Nebel, Licht & Sicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-209]] | Aufdecken: von Hand oder beim Bestätigen einer Bewegung, dann entlang des Pfads Schritt für Schritt; von Hand zeigt das Token, wen es sieht und von wem es gesehen wird (Sichtlinie, passive Wahrnehmung gegen Heimlichkeit, −5 im Dämmerlicht) | – | 3 | 3 | steht |
| [[REQ-139]] | Fog of war | – | 4 | 8 | steht |
| [[REQ-140]] | Light & line of sight with walls | – | 5 | 13 | steht |

### F-058 Bewegung & Zonen

Bewegungsrechner, Pfad, Zonen, Vollbild und eigene Tokens bewegen. — [[F-058 Bewegung & Zonen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-312]] | Eigenes Token bewegen | Spieler | 2 | 3 | teils |
| [[REQ-206]] | Bewegungsrechner auf der Karte: Diagonalen 5-10-5, gezählt je Kreatur und Zug und mit jedem Zug neu; Modi „genauer Weg“, „grösste Reichweite“, „aus“; das Tempo des Zuges ist eine Zahl, die man ändert (Spurt, Klettern, Schwimmen, Sonderfälle), und die SL darf übersteuern | – | 3 | 3 | steht |
| [[REQ-207]] | Wählbarer Pfad: Wegpunkte setzen (um eine Falle herum, nicht an einem Gegner vorbei), zwischen ihnen der günstigste Weg; die Diagonalenzählung läuft über die Wegpunkte weiter; Gefahren und Reichweite von Gegnern können gemieden werden | – | 3 | 2 | steht |
| [[REQ-208]] | Zonen mit eigenen Regeln: eine Zonenart ist ein Regelartikel; Bewegungskosten, Licht, Sicht und „versteckt bis passive Wahrnehmung n“ rechnet die Karte, Schaden, Rettungswurf, Zustand und freie Regeln zeigt sie und schreibt sie beim Betreten ins Protokoll | – | 3 | 5 | teils |
| [[REQ-210]] | Karte und Initiative je als Vollbild, je mit SL- und Spieleransicht; Spielende bewegen ihre eigenen Tokens und prüfen die Reichweite selbst | – | 3 | 3 | teils |

### F-059 Gebiete & Overlays

Gebiete und Hervorhebungen auf der Karte. — [[F-059 Gebiete & Overlays]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-137]] | Overlays: query-driven highlights (faction locations, biomes, routes) | – | 4 | 5 | teils |
| [[REQ-193]] | Territory overlays rasterised onto the map grid from shapes (rect, circle, ellipse, polygon) | – | 4 | 3 | steht |

### F-060 Reisen & Erkundung

Point-Crawl, Erkundungsstand, Vorräte und Aktionen je Knoten. — [[F-060 Reisen & Erkundung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-168]] | Point-crawl travel: node/edge graph attached to a Location, with per-edge sensory read-aloud text and per-node arrival state | – | 3 | 5 | steht |
| [[REQ-169]] | Exploration state ladder per map feature (verborgen → entdeckt → erkundet) with cascade: exploring a node reveals its edges as discovered | – | 3 | 3 | steht |
| [[REQ-170]] | Travel resource cadence: consumables consumed every N nodes or watches, configurable per travel ruleset | – | 4 | 2 | steht |
| [[REQ-171]] | Per-node action budget: one action per character per node from a configurable list (sneak, craft, forage, rest) | – | 4 | 3 | steht |

### F-061 Karteneditor

Zeichnen, Assets platzieren, Effekte. — [[F-061 Karteneditor]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-141]] | Map effects & animations (conditions, weather) | – | 5 | 8 | offen |
| [[REQ-142]] | Drawing, stamps, brushes, layers on maps | – | 5 | 8 | offen |
| [[REQ-143]] | Map editor / full map creation | – | 5 | 13 | offen |

## EP-10 Medien & Assets

18 Stories · 76 Punkte · 4 steht · 3 teils · 11 offen — [[EP-10 Medien & Assets]]

### F-062 Asset-Ablage

Wo Bilder und Dateien liegen und wie sie gefunden werden. — [[F-062 Asset-Ablage]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-020]] | SourceRef provenance: publication, page, optional file + page anchor | – | 1 | 2 | steht |
| [[REQ-021]] | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | – | 1 | 3 | steht |
| [[REQ-145]] | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | – | 1 | 3 | teils |
| [[REQ-146]] | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | – | 2 | 5 | offen |
| [[REQ-022]] | Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side | – | 3 | 5 | offen |
| [[REQ-148]] | External URL assets | – | 3 | 1 | steht |
| [[REQ-150]] | Audio asset storage | – | 5 | 2 | offen |
| [[REQ-151]] | 3D file viewer / repository | – | 5 | 8 | offen |

### F-063 Bildverwaltung

Hochladen, Übersicht, Bildklassen, Ersetzen, Import der Bilder. — [[F-063 Bildverwaltung]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-147]] | Image upload, portraits, icons | – | 2 | 2 | teils |
| [[REQ-295]] | Bild ersetzen als Fassung oder neue Quelle | Spielleitung | 3 | 2 | offen |
| [[REQ-296]] | Bildklassen | Spielleitung | 3 | 2 | teils |
| [[REQ-297]] | Bilder aus 5e.tools einlesen und verknüpfen | Spielleitung | 3 | 5 | offen |

### F-064 Token-Werkstatt

Bilder bearbeiten, Tokens zusammenstellen. — [[F-064 Token-Werkstatt]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-298]] | Bilder bearbeiten und Tokens zusammenstellen | Spielleitung | 4 | 8 | offen |

### F-065 Druck & Ausfuhr

Ein Artikel auf einem Blatt, Karten und Bögen drucken, Ausfuhr nach Markdown. — [[F-065 Druck & Ausfuhr]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-029]] | Serializable schema / export (future file or git backing) | – | 3 | 3 | steht |
| [[REQ-167]] | Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config | – | 3 | 5 | offen |
| [[REQ-195]] | Statblock export back to Obsidian markdown, preserving `{VAR}` placeholders unresolved | – | 4 | 2 | offen |

### F-066 PDF & OCR

PDF anzeigen, Seiten anspringen, Texte erkennen. — [[F-066 PDF & OCR]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-149]] | PDF viewer with page-anchor jump from SourceRef | – | 4 | 5 | offen |
| [[REQ-152]] | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | – | 5 | 13 | offen |

## EP-11 Oberfläche & Navigation

24 Stories · 77 Punkte · 13 steht · 5 teils · 5 offen · 1 ersetzt — [[EP-11 Oberfläche & Navigation]]

### F-067 Boards

Leinwände mit Platzierungen, Ankern und Bereichen; Anlegen auf dem Board. — [[F-067 Boards]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-111]] | Boards: user-owned configurable views with tabs/pages and widgets; DM and player boards share the mechanism | – | 2 | 8 | steht |
| [[REQ-157]] | Canvas boards: free positioning, scaling and arrangement of entity placements on a board (Figma/Canva-style), beyond the widget grid | – | 2 | 8 | steht |
| [[REQ-158]] | Placement rendering: each placement resolves to a facet/renderer via the display resolution; explicit per-placement override always wins | – | 2 | 3 | steht |
| [[REQ-161]] | Display resolution as priority system: entity profile proposes, board rules (per interface / attribute value) decide, user overrides; placement override wins; ties → board rule; works board-only | – | 2 | 5 | steht |
| [[REQ-165]] | Board placements beyond content entities: assets (images, icons), geometric/mathematical shapes as inline canvas objects, and tool objects (interactive widgets such as creature creator or generators) on the canvas | – | 2 | 3 | steht |
| [[REQ-166]] | Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow | – | 2 | 2 | teils |
| [[REQ-119]] | Player boards | – | 3 | 3 | offen |
| [[REQ-159]] | Frames / viewpoint anchors: named canvas viewports (position, zoom depth, target facet, visible layers), persisted in the board config | – | 3 | 3 | steht |
| [[REQ-160]] | Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board | – | 3 | 2 | teils |
| [[REQ-291]] | Leseansicht auf dem Board | Spielleitung | 3 | 3 | offen |
| [[REQ-162]] | Semantic zoom: zoom depth maps onto facets (compact list of weapon properties → full detail on zoom-in); anchors may store a target facet | – | 4 | 5 | offen |

### F-068 Suche

Übergreifende Suche beim Tippen, Volltext. — [[F-068 Suche]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-304]] | Übergreifende Suche beim Tippen | Spieler | 1 | 3 | steht |
| [[REQ-028]] | Full-text search across content | – | 3 | 3 | teils |

### F-069 Filter & Filtergruppen

Filter einer Seite, gespeicherte Filtergruppen. — [[F-069 Filter & Filtergruppen]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-303]] | Filtergruppen je Seite | Spielleitung | 2 | 3 | steht |
| [[REQ-302]] | Der Filter gehört der Seite | Spielleitung | 3 | 1 | steht |

### F-070 Navigation & Kurzansicht

Kopfleiste, Brotkrumen, Kurzansicht als Popup, Kampagne und Ebene sichtbar. — [[F-070 Navigation & Kurzansicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-315]] | Globale Kopfleiste | Spieler | 1 | 2 | steht |
| [[REQ-248]] | Kurzansicht überall: wo ein Artikel genannt wird (auch Ebenen in Filtern, Chips, Listen), öffnet ein Klick bzw. Antippen ein Popup mit der Quick-Ansicht und einem Link zum Artikel; Brotkrumen für die Navigation | – | 2 | 5 | steht |
| [[REQ-305]] | Kampagne und Ebene immer sichtbar | Spielleitung | 2 | 2 | offen |

### F-071 Bearbeiten in der Ansicht

Felder dort bearbeiten, wo sie stehen; optionale Felder; Löschen mit Rückfrage. — [[F-071 Bearbeiten in der Ansicht]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-299]] | Optionale Felder verdeckt | Spielleitung | 3 | 2 | teils |
| [[REQ-307]] | Löschen mit Rückfrage in der Seite | Spielleitung | 3 | 1 | steht |

### F-072 Design & Stilkonzept

Pergament wie die Bücher, Lesbarkeit, Stilkonzept, Sprache der Oberfläche. — [[F-072 Design & Stilkonzept]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-153]] | German UI output with i18n-ready string handling | – | 2 | 2 | ersetzt |
| [[REQ-300]] | Gestaltung wie die Bücher | Spielleitung | 3 | 3 | teils |
| [[REQ-306]] | Lesbarkeit im Feinschliff | Spieler | 3 | 2 | steht |
| [[REQ-301]] | Stilkonzept in der Verwaltung anpassen | Verwaltung | 4 | 3 | offen |

## EP-12 Import & Inhalte

10 Stories · 39 Punkte · 5 steht · 2 teils · 1 offen · 2 verworfen — [[EP-12 Import & Inhalte]]

### F-073 5e.tools-Import

Einmal einlesen, danach ergänzen; jede Quelle in ihre Ebene. — [[F-073 5e.tools-Import]]

| ID | Story | Rolle | Prio | Aufwand | Stand |
|---|---|---|---|---|---|
| [[REQ-047]] | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | – | 2 | 5 | verworfen |
| [[REQ-090]] | Rule import from Obsidian markdown and 5e.tools data | – | 2 | 3 | verworfen |
| [[REQ-239]] | Jedes Buch eine eigene Ebene (PHB, MM, DMG, XGE …), statt einer Ebene für alles aus 5e.tools; eine Kampagne schaltet die Bücher auf, die sie nutzt | – | 2 | 3 | steht |
| [[REQ-243]] | Alle 5e.tools-Inhalte als eigene Ebenen, abschaltbar: 2024-Regeln, Unearthed Arcana, Fahrzeuge, Kartendecks, Bastionen — damit die Leitung Ebenen umschalten und Fassungen eines Artikels nebeneinander zeigen kann | – | 2 | 8 | steht |
| [[REQ-233]] | 5e.tools über eine Pipeline einlesen statt von Hand auf dem Server: dev von selbst, wenn sich der Importer ändert, prod nur von Hand; vorher eine Sicherung, ein Probelauf ist möglich, der Bericht steht im Lauf | – | 3 | 3 | steht |

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

# Regeln: was steht, was noch umzusetzen ist

Stand 19.10.2026, gelesen auf dev (Kampagne „Testkampagne“, `GET /api/rule-articles`,
Ebenen „Table rules“ und „Basil Homebrew System“) und abgeglichen mit den
Rechenwerken in `packages/model/src`. Gehört zu T-270 und E-102 (Engines
bleiben Code für die Rechnung, Automationen werden Daten je System).

## Kurzfassung

| | Anzahl | Wo die Logik heute wohnt |
|---|---:|---|
| Systeme (`Rule.kind: system`) | 15 | — (Ordner) |
| Regeln mit Laufzeitschlüssel (`Rule.key`) | 23 | Code, der Artikel ist die Wahl |
| Optionen darunter | 45 | Code |
| Regeln mit Graph | 12 | Graph, **läuft aber nur im Labor** |
| Hausregeln ohne Schlüssel und ohne Graph (Basil) | 12 | Code oder gar nicht |

**Der wichtigste Befund:** Kein Graph wirkt heute am Tisch. `runRules` wird nur
von `/lab/rules` aufgerufen. Zugplan, Initiative, Karte, Inventar und Handwerk
erzeugen keine Ereignisse, auf die ein Graph hören könnte. Solange diese
Ereignisquelle fehlt, ist jeder weitere Graph eine Beschreibung und keine Regel.
Darum steht die Ereignisquelle in der Reihenfolge unten vor jedem neuen
Baustein.

Zweiter Befund: Zwei Graphen gibt es **doppelt**. Die Gelegenheitsattacke
rechnet `opportunityAttacks` im Zugplan schon, und die Reaktion setzt
`reactionBack` zurück. Bevor beides als Graph läuft, muss feststehen, wer führt.
Sonst bietet der Tisch dieselbe Reaktion zweimal an.

## Die Gruppen

Jede Regel gehört genau einer Gruppe an. Die Gruppe sagt, ob die Regel ein Graph
wird und warum nicht.

| Gruppe | Was | Wird Graph? | Anzahl |
|---|---|---|---:|
| **A — Einstellung** | Eine Wahl, die ein Rechenwerk liest | nein | 23 Regeln, 45 Optionen |
| **B — Rechenwerk** | Geometrie, Raster, Stapel, Wegsuche | nein, höchstens Parameter | 8 |
| **C — Ereignisregel, Bausteine reichen** | Auslöser → Bedingung → Folge | ja, steht schon | 12 (mit Lücken) |
| **D — Ereignisregel, Bausteine fehlen** | wie C, aber ein Auslöser, Test oder eine Folge fehlt | ja, nach den neuen Bausteinen | 6 |
| **E — Fassungen** | dieselbe Regel in 2014 und 2024 | je Fassung ein Artikel | 7 Paare |
| **F — Text oder Idee** | Nichts zu rechnen oder noch nicht entschieden | nein | 2 |

### A — Einstellungen: bleiben Code, der Artikel ist die Wahl

Diese Regeln wählen etwas aus, das ein Rechenwerk ohnehin rechnet. Sie sind
**keine Ereignisse**: Nichts passiert, auf das sie reagieren. Als Graph stünde
dort nur ein Auslöser „immer“ mit einer Folge „setze Option“, also ein Umweg
ohne Gewinn. Sie bleiben, was sie seit PR #245 sind: Artikel unter ihrem System,
gewählt in Rules & options, gelesen über `RULE_OPTIONS`.

| System | Regel (`key`) | Optionen | Rechenwerk |
|---|---|---|---|
| Ability scores | Ability score methods (`abilityMethods`) | Mehrfachwahl | `abilities.ts` |
| Starting equipment | Starting equipment methods (`equipmentMethods`) | Mehrfachwahl | `equipment.ts` |
| Character options | Feats (`feats`) | Allowed, Not allowed | Bogen |
| | Hit points per level (`hitPoints`) | Roll or average, Average, Roll | `hitpoints.ts` |
| | Languages in play (`languages`) | Liste | Bogen |
| Inventory | Inventory rules (`inventory`) | Grid, Weight, Slots | `inventory.ts` |
| | Unstowed Loot Is Left Behind (`stowing`) | Any time, By session end, Immediately | `stowing.ts` |
| Crafting | Crafting Checks, Failure and Crits (`craftFailure`) | 6 | `crafting.ts` |
| | On a natural 20 (`craftCritSuccess`) | 2 | `crafting.ts` |
| | On a natural 1 (`craftCritFailure`) | 3 | `crafting.ts` |
| | Player checks count (`craftConfirm`) | 2 | `crafting.ts` |
| | Known blueprints (`craftLearning`) | All, Only taught, By rarity | `crafting.ts` |
| | Blueprints up to (`craftLearnRarity`) | 6 Seltenheiten | `crafting.ts` |
| | Material Substitutes (`substitutions`) | Liste | `substitutes.ts` |
| Travel | Rations, light and watches (`travel`) | Zähler | Gruppe, `Party` |
| Units | Units shown (`units`) | Liste | `units.ts` |
| On the map | Fog of war (`fog`) | Per character, Shared | `sight.ts` |
| | Player moves (`moves`) | Confirm, Free | Karte |
| | Moves reveal the way (`revealOnMove`) | Yes, No | `sight.ts` |
| | Doors (`doors`) | Players, GM only | `walls.ts` |
| At the table | Player rolls visible to (`playerRolls`) | Table, GM | `rolls.ts` |
| | Compare layers visible to (`compareFor`) | GM, Players | Stapel |

Hier ist nichts umzusetzen. Zwei Ausnahmen:

- **Doppelt, erledigt 21.10.:** „Travel Rations, Light and Watches“ (ohne
  Schlüssel) und „Rations, light and watches“ (`travel`) sagten dasselbe. Die
  Regel mit Schlüssel trägt jetzt Name und Text der Hausregel, die Hausregel
  ging in ihr auf (Massenänderung mit Undo, Leitung 20.10.).
- **Kampagnen- statt Installationseinstellung:** Die Reisezähler stehen laut
  Text noch an der Installation (T-132). Das ist eine Frage der Einstellung,
  nicht des Graphen.

### B — Rechenwerke: bleiben Code, höchstens mit Parametern am Artikel

Diese Regeln rechnen über Raster, Wege oder Stapel. Ein Graph prüft *eine*
Lage zu *einem* Ereignis. Eine Wegsuche über ein Gitter oder das Einpassen
gedrehter Teile in ein Raster ist eine Schleife über viele Lagen. Das als Knoten
zu bauen hiesse, eine Programmiersprache nachzubauen, und genau dafür steht das
Abbruchkriterium in E-102.

Was am Artikel sinnvoll ist: **die Zahlen**. Die Spalten der Ziehzeiten oder
die Kosten der Diagonale sind Kampagneninhalt und gehören als Felder an den
Regelartikel. Das Rechenwerk liest sie von dort statt aus dem Code.

| Regel | Rechenwerk | Was als Parameter an den Artikel kann |
|---|---|---|
| Diagonals 5-10-5, Counted per Turn | `movement.ts`, Zugplan | Diagonale: `5`, `5-10-5`, `10`; Zählung je Zug |
| Difficult Terrain by the Worst Square | `movement.ts` | „teuerstes Feld“ vs. „Summe“ |
| Draw Time by Column | `inventory.ts`, Zonen | Spaltengrenzen und Stufen (heute in Basils Bogen) |
| Containers Add a Draw Step | `inventory.ts` | Schritte je Behälterstufe |
| Body Slots | `slots.ts` | Slots und ihre Ziehzeit (heute in Basils Bogen) |
| Stacking in the Grid | `inventory.ts` | — (offen: E-074, E-075) |
| Carry Grid by Size and Strength | `inventory.ts` (`carrying`) | Rastergrösse je Grösse und STR |
| Materials Bound at Start | `crafting.ts` | — (reine Ablaufregel) |

Diese acht stehen heute in Rules & options nicht als wählbar, weil sie keinen
Schlüssel haben. Damit sie dort erscheinen und ein- und ausschaltbar werden,
bekommen sie einen Schlüssel und das Rechenwerk eine Option. Für jede ist das
eine kleine Codeänderung. Sie zu migrieren heisst hier: **Schlüssel plus
Parameter**, kein Graph.

### C — Ereignisregeln, die mit den heutigen Bausteinen stehen

Diese zwölf Graphen gibt es auf dev, und der Probelauf rechnet sie. Die Tabelle
sagt, wie nahe jeder am Regeltext ist. Was fehlt, ist in D als Baustein
aufgeführt.

| Regel | System | Stimmt? | Was fehlt |
|---|---|---|---|
| Hellish Rebuke | Reactions | teilweise | Auslöser ist `hit`, der Text sagt „damaged“; „you can see“; Zauberplatz |
| Snatch Punisher (Basil) | Reactions | ja | — |
| Opportunity attack | Movement | ja | **doppelt mit `opportunityAttacks`**; 2024: nur willentliche Bewegung |
| Sentinel | Reactions | ein Drittel | Disengage-Teil und Speed 0 fehlen, siehe E |
| Shield | Spellcasting | teilweise | +5 RK bis zum nächsten Zug (Dauer); Treffer wird zum Fehlschlag; jeder Platz ab Grad 1; Magic Missile |
| Counterspell | Spellcasting | 2014 | 2024 ist ein Rettungswurf statt eines Attributswurfs; „can see“; Zaubergrad steckt in `amount` |
| Uncanny Dodge | Reactions | teilweise | „attacker that you can see“; Halbieren als echte Folge |
| Concentration check | Hit points | ja | der Wurf selbst; 2024 Obergrenze 30 |
| Dropping to 0 hit points | Hit points | ja | doppelt mit dem Rechenwerk der Trefferpunkte, wer führt? |
| Regeneration | Hit points | teilweise | Betrag fest 10 statt aus dem Statblock; Feuer oder Säure seit dem letzten Zug braucht den Schadenstyp |
| Somatic components need a free hand | Hands | ja | Fokus oder Schild mit Fokus (2024) |
| Start of turn | Turn | ja | doppelt mit `reactionBack` |

### D — Ereignisregeln, die neue Bausteine brauchen

| Regel | Fehlt | Neuer Baustein |
|---|---|---|
| Sentinel 2014 und 2024 | Disengage als Auslöser, Speed 0 bis Zugende | Auslöser `usesAction`, Folge mit Dauer |
| Drop Free, Stow as a Bonus Action | Kosten einer Handlung | Auslöser `itemStowed`/`itemDropped`, Folge `spendResource` |
| Enemies Hidden Until Their First Turn | Runde 1, vor dem eigenen Zug | Auslöser `roundStart`, Variable `round`, Folge `hideInOrder`/`revealInOrder` |
| Learned Blueprints | Start eines Auftrags | Auslöser `craftStarts`, Test `knows` auf einen Artikel statt auf einen Namen |
| Unstowed Loot Is Left Behind | Sitzungsende, Verlassen der Karte | Auslöser `sessionEnd`, `leavesMap` (Optionen bleiben A) |
| Travel Rations, Light and Watches | Schritte zählen | Auslöser `stepTaken`, Folge `changeValue` mit Zähler (Zähler bleiben Code, der Graph sagt „fällig“) |

### E — Fassungen: ein Artikel je Fassung, verglichen wie Varianten

Eine Regel, die in 2014 und 2024 verschieden ist, bekommt **je Fassung einen
Regelartikel** in der Ebene ihres Buchs (PHB 2014, XPHB 2024), so wie Talente
und Zauber heute auch. Beide hängen am selben System. Der Vergleich zeigt sie
nebeneinander wie `artikel/:id/compare/:other`.

| Regel | 2014 (PHB) | 2024 (XPHB) |
|---|---|---|
| **Sentinel** | (1) Gelegenheitsangriff trifft → Speed 0 für den Zug. (2) Disengage schützt nicht. (3) Kreatur in 5 ft **greift** ein anderes Ziel an (das Sentinel nicht hat) → Reaktion: Nahkampfangriff. | *Guardian:* Kreatur in 5 ft nutzt **Disengage** oder **trifft** ein anderes Ziel → Gelegenheitsangriff. *Halt:* Gelegenheitsangriff trifft → Speed 0 für den Zug. |
| **Counterspell** | Grad ≤ 3 scheitert; sonst Attributswurf SG 10 + Grad | Ziel macht einen KON-Rettungswurf; gelingt er, bleibt der Platz |
| **Shield** | +5 RK bis zum Beginn deines nächsten Zugs, auch gegen Magic Missile | gleich, Wortlaut neu |
| **Opportunity attack** | Kreatur verlässt die Reichweite | nur willentlich, durch Bewegung, Aktion, Bonusaktion oder Reaktion |
| **Hellish Rebuke** | durch Schaden ausgelöst, 2d10 Feuer, GES-Rettungswurf | gleich, Skalierung neu |
| **Uncanny Dodge** | halbiert den Schaden eines sichtbaren Angreifers | gleich |
| **Concentration** | SG 10 oder halber Schaden | dazu Obergrenze SG 30 |

**Ein Graph mit mehreren Auslösern geht schon heute.** `runRules` startet an
jedem Auslöserknoten, dessen `on` zum Ereignis passt. Sentinel 2014 wird so
*eine* Regel mit drei Auslösern (`hit` durch den eigenen Gelegenheitsangriff,
`usesAction: Disengage`, `attacked`). Zwei Prozesse wären zwei Artikel, die nur
zusammen stimmen, und der eine ginge ohne den anderen verloren. Darum ist der
Vorschlag: eine Regel je Talent und Fassung, mehrere Auslöser darin.

### F — Text oder Idee: wird nicht migriert

| Regel | Warum nicht |
|---|---|
| Facing and Spotting (idea) | Status `idea`, nicht entschieden. Bräuchte Blickrichtung an der Marke und einen Zustand „Spotted“. Erst als Story, dann als Regel. |
| Basil Homebrew System | Der Systemtext der Ebene. Ein Ordner, keine Regel. |

## Neue Bausteine

Geordnet nach der Zahl der Regeln, die darauf warten.

### Laufzeit (Voraussetzung für alles)

| Baustein | Wozu | Regeln |
|---|---|---|
| **Ereignisquelle** | Zugplan, Initiative, Karte, Inventar und Handwerk senden `RuleEvent`s. `runRules` läuft am **Server** mit dem gesiebten Stand. | alle aus C und D |
| **Vorschlag statt Ausführung** | Eine Folge ist ein Angebot an die Spielerin oder Leitung, bestätigt im Zugplan (wie T-198). Nichts ändert sich ohne Klick. | alle |
| **Wer führt** | Je Rechenwerk entscheiden, ob Code oder Graph eine Sache anbietet (Gelegenheitsattacke, Reaktion zurück, 0 TP). Nie beide. | OA, Start of turn, 0 TP |
| **Schalter je Regel** | `graph.enabled` gilt heute für alle; künftig je Kampagne wie die Optionen in A. | alle |

### Auslöser

| Neu | Event trägt | Regeln |
|---|---|---|
| `usesAction` | `action`: Disengage, Dash, Dodge, Help, Hide, … | Sentinel 2014/2024 |
| `roundStart` | `round` | Enemies Hidden |
| `itemDrawn`, `itemStowed`, `itemDropped` | `item`, `zone` | Drop Free/Stow, Draw Time (Kosten anbieten) |
| `craftStarts`, `craftCheck` | `recipe`, `roll`, `natural` | Learned Blueprints; Crafting-Optionen könnten später auch Graphen werden |
| `sessionEnd`, `leavesMap` | — | Unstowed Loot |
| `stepTaken` | `steps` | Travel |
| `conditionGained`, `conditionLost` | `condition` | Prone, Concentration (enden), viele Talente |
| `savingThrow` | `ability`, `dc`, `success` | Counterspell 2024, Concentration |
| `shortRest`, `longRest` | — | Ressourcen zurück (Talente, Klassen) |

Bestehende Auslöser brauchen **mehr am Event**:

| Event | Neu | Regeln |
|---|---|---|
| `attacked`, `hit`, `missed` | `attackKind`: melee, ranged, spell; `weapon` | Sentinel (Nahkampf), Shield |
| `damaged` | `damageType`, `source` | Regeneration, Hellish Rebuke |
| `castsSpell` | `spellLevel` (statt `amount`), `components` | Counterspell, Somatic |
| `leavesReach` | `willing` | OA 2024 |

### Bedingungen (Tests)

| Neu | Wozu | Regeln |
|---|---|---|
| `canSee` | Sicht aus `sight.ts` und `lighting.ts` | Hellish Rebuke, Uncanny Dodge, Counterspell, OA 2024 |
| `hasCondition` | Zustand aus `Vitals.conditions` | Start of turn (prone), Concentration |
| `knows` auf einen Artikel | Id statt Name, über `knownBy` oder `grants` | alle mit „knows“ |
| `sameSide` | Gruppe und Fraktion (`memberOfParty`, `memberOf`) | Sentinel „ein anderes Ziel“, Verbündete |
| `anyOf` | ein ODER ohne zwei Pfade | Sentinel 2024 (Disengage oder Treffer) |
| Event-Feld | `event.attackKind = melee`, `event.damageType in [fire, acid]` | siehe oben |
| `slotAtLeast` | „ein Platz ab Grad n“ statt `slots1` | Shield, Counterspell, Hellish Rebuke |

### Folgen

| Neu | Wozu | Regeln |
|---|---|---|
| **Dauer an jeder Folge** | `until`: Zugende, Beginn des nächsten Zugs, 1 Minute; läuft über `tickEntries` der Initiative | Sentinel (Speed 0), Shield (+5 RK) |
| `applyEffect` als echter Effekt | schreibt ein `Effect` (`effects.ts`, `add`/`set`) statt eines Satzes | Shield, Sentinel, Prone |
| `modifyEvent` | Schaden halbieren, Treffer zu Fehlschlag | Uncanny Dodge, Shield |
| `requestRoll` | Rettungs- oder Attributswurf mit SG, Ergebnis als neues Ereignis | Concentration, Counterspell, Hellish Rebuke |
| `spendResource` | Reaktion, Bonusaktion, Zauberplatz | alle Reaktionen, Stow |
| `hideInOrder`, `revealInOrder` | Initiativliste für Spielende | Enemies Hidden |
| `blockAction` am Zugplan | heute nur ein Satz; künftig die Kachel sperren | Somatic |

## Was nicht migriert wird, und warum

1. **Einstellungen (A).** Sie reagieren auf nichts. Ein Graph mit dem Auslöser
   „immer“ wäre ein Feld mit Umweg.
2. **Rechenwerke (B).** Wegsuche, Raster und Stapel sind Schleifen über viele
   Lagen. Als Knoten würde das eine Sprache, und das Abbruchkriterium von E-102
   sagt genau das. Die **Zahlen** wandern an den Artikel, die Rechnung bleibt
   Code.
3. **Ideen und Systemtexte (F).** Nichts zu rechnen.
4. **Spielbegriffe** (Zustände, Aktionsarten) sind Glossarartikel und Ziele
   von `knows` oder `hasCondition`, aber selbst keine Regeln.
5. **Talente, Zauber und Merkmale der Bücher** werden nicht in Masse zu
   Graphen. Ein Graph lohnt sich dort, wo der Tisch ihn braucht: Reaktionen,
   die man im Kampf vergisst. Die Reihenfolge sagt die Leitung, nicht ein
   Import.

## Vorgeschlagene Reihenfolge

Jeder Schritt ist für sich nutzbar.

1. **Ereignisquelle und Vorschläge im Zugplan** (Laufzeit). *Steht seit
   20.10.* (`ruleTable.ts`, Option „Rules from graphs“): der Zug sendet
   `leavesReach`, `attacked`, `hit`/`missed` und `damaged`; Hellish Rebuke,
   Uncanny Dodge, Shield und Sentinel (sein dritter Teil) werden angeboten.
   Noch ohne Ereignisquelle: `castsSpell` (Counterspell, Somatic — Zauber
   sind keine Kacheln des Zugplans), `picksUpObject` (Snatch Punisher),
   `turnStart`/`turnEnd` (die Initiative). Dazu kamen `sameSide` und `strike`
   (Annehmen ist ein Nahkampfangriff).
2. **Der Graph führt** bei OA, Reaktion zurück und 0 TP (entschieden 19.10.,
   zuerst als Versuch): ist der Graph der Kampagne an, bietet nur er an, sonst
   der Code wie bisher. *Für die Gelegenheitsattacke steht es seit 20.10.*;
   Reaktion zurück und 0 TP folgen mit `turnStart` und mit Folgen, die
   schreiben dürfen (Schritt 3).
3. **Bausteine für Sentinel**: `usesAction`, `attackKind`, `canSee`,
   Dauer an Folgen (`sameSide` steht). Danach Sentinel 2014 und 2024 als je ein
   Artikel in PHB und XPHB, mit dem Vergleich daneben.
4. **Graph am Artikel**: ein Element `ruleGraph` auf der Artikelseite (lesen,
   bearbeiten, „Open in rule builder“, „Create rule“ an einem Talent ohne
   Regel), und der Vergleich zweier Fassungen.
5. **B: Schlüssel und Parameter** für die acht Rechenwerke, je eines nach
   Bedarf am Tisch.
6. **D: die übrigen Ereignisregeln** (Enemies Hidden, Stow, Learned
   Blueprints, Unstowed Loot, Travel).

## Offene Entscheidungen

- **Story:** REQ-357 Regelgraphen wirken am Tisch (`VTT/Stories/REQ-357.md`).

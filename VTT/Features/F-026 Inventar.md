---
id: "F-026"
title: "Inventar"
typ: "feature"
epic: "[[EP-04 Spielererlebnis]]"
beschreibung: "Liste und Raster, Behälter und Zonen, Ausrüstungsfigur, Ziehen und Verstauen, Gruppeninventar, Gegenstände als Instanz."
tags: ["vtt", "feature"]
---
# F-026 Inventar

Liste und Raster, Behälter und Zonen, Ausrüstungsfigur, Ziehen und Verstauen, Gruppeninventar, Gegenstände als Instanz.

Epic: [[EP-04 Spielererlebnis]]

## Stories

<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->
24 Stories · 62 Punkte · 7 steht · 7 teils · 10 offen

| Story | Rolle | Prio | Stand |
|---|---|---|---|
| [[REQ-064]] Inventar als Liste | Spieler | 2 | steht |
| [[REQ-065]] Inventar als Raster | Spieler | 4 | steht |
| [[REQ-183]] Gruppeninventar | Spieler | 3 | steht |
| [[REQ-214]] Ausrüstungsfigur | Spieler | 4 | steht |
| [[REQ-215]] Tragraster aus Grösse und Stärke | Spieler | 3 | teils |
| [[REQ-216]] Behälter in Behältern | Spieler | 3 | teils |
| [[REQ-217]] Ziehen am Bogen | Spieler | 3 | steht |
| [[REQ-225]] Fallenlassen und Verstauen | Spieler | 3 | teils |
| [[REQ-275]] Erhaltene Gegenstände als Instanz | Spieler | 2 | teils |
| [[REQ-276]] Unverstaute Gegenstände gelten als liegengelassen | Spielleitung | 4 | offen |
| [[REQ-277]] Gegenstände mit Form spiegeln | Spieler | 4 | offen |
| [[REQ-320]] Formen frei malen, auch nicht rechteckig | Spielleitung | 2 | offen |
| [[REQ-321]] Stapel im Raster | Spieler | 2 | offen |
| [[REQ-322]] Besondere Zonen mit eigenen Regeln | Spieler | 2 | offen |
| [[REQ-323]] Alle möglichen Plätze eines Gegenstands | Spieler | 2 | teils |
| [[REQ-324]] Hände als Plätze mit Regeln | Spieler | 2 | teils |
| [[REQ-325]] Gegenstandsartikel im Detailbereich | Spieler | 2 | offen |
| [[REQ-326]] Ziehen und Ablegen im Raster | Spieler | 2 | offen |
| [[REQ-327]] Packen am Telefon | Spieler | 2 | offen |
| [[REQ-328]] Ablage für nicht Verstautes | Spieler | 2 | offen |
| [[REQ-333]] Vorgaben für Formen und Stapel | Spielleitung | 2 | teils |
| [[REQ-355]] Tragraster, Zonen und Behälter einstellen | Spielleitung | 2 | steht |
| [[REQ-356]] Tragblatt aus Bausteinen mit Zonen und Bedingungen | Spielleitung | 2 | steht |
| [[REQ-391]] Tragestufen mit Folgen | Spieler | 3 | offen |
<!-- stories:ende -->

## Ausrüsten in die Hände (T-244, Demo-Etappe)

Im Reiter **Gear** einer Figur stehen über dem Raster die Hände. Ein Stück
antippen (Raster, Liste, „Not stowed"), dann eine Hand — oder mit der Maus
hinziehen. Gerechnet wird in `packages/model/src/wield.ts`: `wieldPlan`
sagt, ob der Griff geht und wer weichen muss, `applyWield` schreibt die
Kanten (`holds.props.slot`, `holds.props.grip: two` für beide Hände),
`wieldOptions` listet alle Ziele mit ✓/⚠/✗ und Grund, `handChecks` sagt,
was die Hände erlauben. Was die Hände sperren, rechnet weiter `handState`
(T-247) — dieselbe Sperre in „Your turn".

```mermaid
flowchart TD
  A[Stück antippen<br>Raster · Liste · Not stowed] --> B[Hand antippen<br>oder hinziehen]
  B --> C{wieldPlan}
  C -- Grund --> X[✗ Hinweis, nichts ändert sich]
  C -- frei --> W[applyWield schreibt holds]
  C -- belegt --> D[Warnung: verstauen · fallen lassen · abbrechen]
  C -- vielseitig beidhändig, Nebenhand gebraucht --> G[Warnung: Griff wechselt auf eine Hand]
  D -- verstauen --> S[stowSpots: freier Platz im Raster, sonst Not stowed]
  D -- fallen lassen --> F[tier ground]
  S --> W
  F --> W
  G --> W
  W --> H[handState → Hände, Prüfungen, Your turn mit 🔒 Grund]
```

Zweite Etappe (T-244): Gürtel als Gegenstand mit Raster und Verbund,
Köcher mit Filter, Verstaukosten aus dem Modul, Stapel teilen, Anker,
schwebende Werkzeugleiste, Telefon-Muster.

## Gegenstandsmerkmale (T-324, E-163)

Was an einen Gegenstand kommt, ohne selbst einer zu sein, ist ein
**Regelartikel** der Art `ItemFeature` — wie ein Monstermerkmal am
Statblock. Zwei Sorten: die **Eigenschaft** (`ItemProperty`: Finesse,
Versatile, Two-Handed) hängt mit `hasProperty` am Gegenstand, das
**Enhancement** (+1 Weapon, Silvered) mit `enchantedWith` an einem Stück.
Was ein Merkmal am Bogen bewirkt, steht in seinem Feld `mechanics`, nicht
in seinem Namen; was es bei diesem Gegenstand heisst (Versatile 1d10,
Thrown 20/60), an der Kante. Name, Preis und Boni des Stücks rechnet das
Lesen (D8). Migration 163 hat die eingelesenen Varianten zu Enhancements
gemacht; Felder, die ein Merkmal nicht trägt, stehen in ihren Notizen.

```mermaid
flowchart LR
  W[Longsword<br>Weapon] -- hasProperty<br>damage 1d10 --> V[Versatile<br>ItemProperty<br>mechanics: versatile]
  S[Stück von Longsword] -- instanceOf --> W
  S -- enchantedWith --> P[+1 Weapon<br>Enhancement<br>Präfix, Aufpreis, Bonus]
  S -- enchantedWith --> Si[Silvered<br>Enhancement]
  V -. mechanics .-> B[Bogen: Griff mit beiden Händen<br>nimmt den Würfel der Kante]
  P -. enhanceItem .-> N[„+1 Silvered Longsword“<br>Preis gerechnet]
```

## Vorgabeformen (T-394, E-165)

Form und Stapel eines Gegenstands werden beim Lesen gerechnet (D8): aus
dem Untermodul „Default shapes“ des Inventarmoduls — Gruppen und Werte je
Gegenstand —, nicht aus Artikeln je Gegenstand. Die Werte stehen in der
Ebene der Mechanik **Grid** und kommen so mit dem Regelwerk (D90); eine
Kampagne schaltet sie auf und passt sie mit einer eigenen Ebene darüber an. Der erste Treffer gilt:

```mermaid
flowchart TD
  A["Item.rows am Gegenstand?"] -- ja --> E1["eigene Angabe (item)"]
  A -- nein --> B["eigene Form im Untermodul?"]
  B -- ja --> E2["own (auch: keine)"]
  B -- nein --> C["Referenzgegenstand?"]
  C -- ja --> C2["dessen Form, Kette ≤ 6 (reference)"]
  C -- nein --> D["Gruppe trägt nicht?"]
  D -- ja --> E3["keine Form (none)"]
  D -- nein --> F["Auswahl nach Preis?"]
  F -- ja --> E4["Zufallsform aus der Id (random)"]
  F -- nein --> G["Form der Gruppe oder ihres Referenzgegenstands (group)"]
```

Ein Stapel am Gegenstand oder im Untermodul gilt über jeder geerbten Form.
Die Herkunft kommt mit dem Artikel (`refs.shape`). Regel: G15 in
`docs/Datenmodell.md`; Code: `packages/model/src/defaultShapes.ts`.

**Übersicht und Wahl am Gegenstand** (T-394): `/inventory/shapes`
(Rules & options › Inventory › Item shapes) zeigt links die Gruppen,
rechts die Gegenstände mit geltender Form, Herkunft und der Marke „local“
für eigene Angaben; das Element Shape am Gegenstand sagt, woher seine
Form kommt, und setzt Gruppe und Referenzgegenstand („Group &
reference“). Geschrieben wird in die Karte `ShapeDefaults` einer
Formebene, gegen die gelesene Revision.

**Ankerzelle** (REQ-402, T-406): Wer ein liegendes Stück an einer seiner
Zellen wählt, hält es dort; ein Tippen auf ein freies Feld legt es so ab,
dass genau diese Zelle dort liegt (`grabAnchor`, `placeByAnchor`). Aus
„Not stowed“ hält man es am ersten belegten Feld der obersten Zeile
(`defaultAnchor`). Die Ankerzelle ist markiert.


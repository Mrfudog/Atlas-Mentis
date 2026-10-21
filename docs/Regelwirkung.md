# Regelwirkung — wirken die Regeln am Tisch?

**Bereich Regelwirkung (T-322).** Die Grundlinie für die Prüfung nach jedem
Release: je Regel aus dem Regelkatalog (18.10., 157 Regeln, Tafel „Rule
catalogue" im Design-Canvas, Reiter Findings) die Frage, ob sie **am Tisch
eine Zahl ändert** — nicht, ob sie irgendwo gerechnet wird. Eine Wirkung,
die gesammelt und nicht angewandt wird, ist eine Behauptung.

Je Punkt steht hier, was heute wirkt, wo es gerechnet wird, welcher Test es
am Tisch prüft und was fehlt. Wer nach einem Release prüft, geht die
Tabelle durch und lässt die genannten Tests laufen; was rot wird oder
anders wirkt, ist ein Fehler am Tisch.

Grundsatz für alles hier (E-102 bleibt offen): **keine eigene Engine**. Die
Rechnung steht im Modell (`packages/model`), beim Lesen (D8), mit genau den
Eingaben, die eine spätere Automation hätte — sie zieht dann um, statt neu
zu entstehen.

## Stand (T-275, Teil 1 — 21.10.2026)

| # | Lücke aus dem Katalog | Stand | Wo | Test „wirkt am Tisch" |
|---|---|---|---|---|
| 1 | Wirkungen gesammelt, nicht angewandt; RK nur gespeichert | **wirkt** | `characterStats`, `creatureStats` (`stats.ts`), `effectsAt`/`itemsAt` (`effects.ts`); Initiative `participantStats`, Zugplan `rkVon` | `packages/model/test/regelwirkung.test.ts` › Punkt 1 |
| 2 | Schaden nicht von den TP abgezogen, Konzentration nur angezeigt | **wirkt** (Zugplan; der Tracker zieht weiter von Hand ab) | `damageAfterDefenses`, `concentrationCheck` (`damage.ts`); Server `schadenAnwenden` (`zugplan.ts`) | `apps/server/test/regelwirkung.test.ts` › Punkt 2, `regelwirkung.test.ts` › Punkt 2 |
| 3 | Zwei Aktionskataloge, zwei Kostenleser; nur Dash/Disengage wirken | **eine Quelle**; Dodge, Help, Hide wirken (Vorteil/Nachteil), Ready als Eintrag | `COMMON_ACTION_CATALOGUE`, `turnTypeOf`/`costOf` (`actions.ts`); Server `aktionWirkt`, `trefferWurf` | `apps/server/test/regelwirkung.test.ts` › Punkt 3, `regelwirkung.test.ts` › Punkt 3 |
| 4 | Zwei Übungsbonus-Formeln | **eine Quelle** | `proficiencyBonus` (`calc.ts`), Register `profBonus(hasClass.level)` | `regelwirkung.test.ts` › Punkt 4 |
| 5 | Passive Wahrnehmung ohne Übung/Expertise | **wirkt** | `checkBonus` (`calc.ts`), Register `10+check(wis.Perception)`, Bogen `passivePerception` | `regelwirkung.test.ts` › Punkt 5 |
| 6 | Zugraster sperrt Verbündete, kein schwieriges Gelände | Folgeaufgabe | — | — |
| 7 | drawStage, handActions, Sicht, Reise, tickEntries nur im Prototyp | Folgeaufgabe | — | — |
| 8 | Reichweite nur in der Maske, lange Reichweite ohne Nachteil | Folgeaufgabe | — | — |
| 9 | Kein Auslöser für Rasten | **wirkt** (T-352): kurze Rast (Trefferwürfel), lange Rast (TP, Trefferwürfel, Plätze, Erschöpfung, Todesrettungen) am Bogen; offen: Pakt-Plätze bei kurzer Rast, Merkmale mit Nutzungen, Rast für die ganze Gruppe | `longRest`, `spendHitDie`, `stageDown` (`rest.ts`); Bogen `kopf.ts` | `packages/model/test/rest.test.ts` |
| 10 | Tragestufen ohne Folge, ZoneInfo unausgewertet | Folgeaufgabe | — | — |
| 11 | Registerformeln als Brücke zu Automationen | Grundlage: `profBonus`, `check` sind neue Funktionen des Rechenwerks | `calc.ts` (`FUNCTIONS`) | `regelwirkung.test.ts` › Punkt 4, 5 |
| 12 | Kanten mit `intended` ohne Auswerter | `equips` wird gelesen (Wirkungen), `intended` weg; `affects`, `zone`, `loot`, `entry`, `route` offen | `itemsAt` | `edges.test.ts` |

## Punkt 1 — was jetzt wirkt

Am Bogen, in der Initiative und im Zugplan liest jede Stelle **dieselbe
Rechnung** (`creatureStats`: Statblock finden, aufgelöst, `characterStats`).

- **RK:** trägt die Figur Rüstung oder Schild im Inventar (`holds.tier`
  worn/held oder ein Platz), rechnet die RK daraus — leicht mit ganzer,
  mittel mit höchstens +2 GE, schwer ohne GE, Schild dazu. Sonst gilt die
  Zahl am Statblock, sonst 10 + GE. Steht am Statblock eine andere Zahl,
  sagt es der Hinweis. Wirkungen `ac` (`bonusAc`, Ring des Schutzes)
  kommen dazu, solange sie gelten (getragen, eingestimmt).
- **Statblock mit `equips`:** die Buch-RK enthält die Rüstung schon; was er
  führt, zählt nur mit seinen Wirkungen (ein Schild +1 gibt +1).
- **Tempo:** je Bewegungsart; `add` (Stiefel +10), `set` (Fliegen so
  schnell wie Gehen), `limit` (gepackt: höchstens 0).
- **Abwehr:** Resistenz, Immunität, Verwundbarkeit, Zustandsimmunität aus
  Statblock (Sätze), Herkunft (`Ancestry.resistances`) und Wirkungen
  (`grant`), je Wort mit Quelle; im gelesenen Statblock als Satz.
- **Kritischer Treffer:** `critThreshold` (kleinste gesetzte Schwelle).
- **Zustände wirken:** `Condition` nimmt `Effects`; gelesen werden
  `Vitals.conditions` der Kreatur und die Einträge der Initiative (`rule`).
- **Stücke sind Instanzen:** gelesen wird aufgelöst (`resolvedLookup`), ein
  Stück trägt die Wirkungen seiner Vorlage.
- **Aufschlüsselung (T-272):** „How the numbers come about" zeigt je Teil
  die Quelle (item, equipped, condition, feature …), dazu Abwehr und
  kritischen Treffer.

Noch nicht angewandt (Ziele, die gesammelt und gezeigt werden): `save`,
`save.<attr>`, `spellSaveDc`, `spellAttack`, `check`, `weapon.*`,
`spellDamage`, `carry`. Unarmored Defense (Barbar, Mönch) rechnet erst, wenn
das Merkmal eine Wirkung trägt.

## Punkte 2 und 3 — was jetzt wirkt

- **Schaden:** bestätigt die Leitung einen Zug, würfelt der Server Treffer
  und Schaden und **zieht ab** — nach Immunität (0), Resistenz (halb,
  abgerundet) und Verwundbarkeit (doppelt) des Ziels; ein Satz mit
  Einschränkung („from nonmagical attacks") greift, das Wort steht im
  Ergebnis. Abgezogen wird an der Teilnehmerkante der Begegnung, bei einer
  Spielerfigur auch an `Vitals` (zeitweilige zuerst), ausserhalb einer
  Begegnung an `Vitals`.
- **Konzentration:** konzentriert sich das Ziel, würfelt der Server den
  KON-Rettungswurf gegen SG 10 oder den halben Schaden (Bonus: KON, Übung
  im Rettungswurf, Wirkungen `save`, `save.con`, `save.concentration`);
  misslingt er, endet die Konzentration (E-128: Server würfelt statt einer
  Anfrage an die Spielerin).
- **Vorteil/Nachteil und Krit:** der Angriff würfelt `2d20kh1`/`2d20kl1`,
  wenn die Wirkungen es sagen, und trifft kritisch ab der Krit-Schwelle
  des Angreifers.
- **Ein Aktionskatalog:** Dash, Disengage, Dodge, Help, Hide, Ready,
  Search, Use an object im Zugplan; dieselbe Liste in „Your turn".
  Dodge/Help/Hide/Ready legen einen Eintrag in der Initiative an
  (`TimedEntry.action`), den die Initiative herunterzählt; Help und Hide
  sind beim nächsten Angriff verbraucht.

- **Reichweite am Server** (T-351): Einreichen lehnt einen Angriff ausser
  Reichweite ab (422, mit Hinweis), gemessen vom Ende des Wegs davor
  (`abstandImPlan`, `rangeBand`); Ausführen misst neu, wo die Tokens dann
  stehen, und würfelt ausser Reichweite nicht. Ohne Gitter prüft niemand.
- **Lange Reichweite mit Nachteil** (T-351): `attackRollMode` nimmt die
  lange Reichweite als eine Quelle von Nachteil; das Würfellog sagt
  „(disadvantage, long range)".
- **Zustände geben Vorteil und Nachteil** (T-351) über die Wirkungen ihres
  `Condition`-Artikels: `attack`, `attacked`, und nach Abstand
  `attacked.near` (bis 5 ft) und `attacked.far` — Prone. Die Vorschau im
  Zugplan zeigt die Chance mit dem Modus (`modes`, `long`).

Noch nicht: der Tracker (Damage/Heal) kennt keine Schadensart und zieht
den Betrag weiter ohne Abwehr ab; Wirkungen, die nur unter einer
Bedingung gelten (Restrained: Nachteil auf DEX-Rettungswürfe, Paralyzed:
Krit in 5 ft), brauchen noch eigene Ziele.

## Prüfen nach einem Release

1. `pnpm vitest run packages/model/test/regelwirkung.test.ts apps/server/test/regelwirkung.test.ts` — grün.
2. Auf dev mit der Testfigur in „basil · Tests": Rüstung an- und ablegen →
   RK in Bogen und Initiative folgt; Ring der Resistenz → Resistenzen;
   Zustand „Grappled" setzen → Tempo 0; einen Zug mit Angriff bestätigen →
   TP des Ziels in der Initiative sinken; Dodge planen → nächster Angriff
   gegen die Figur mit Nachteil.
   Einen Bogenschuss über die lange Reichweite planen → „with
   disadvantage"; einen Schlag auf ein entferntes Ziel einreichen → 422
   „out of range"; Zustand „Prone" am Ziel → aus 5 ft Vorteil.
3. Diese Tabelle nachziehen, wenn eine Lücke geschlossen ist.

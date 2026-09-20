# Ruf und Beziehungen

Stand 2026-09-20. REQ-030 und REQ-081 aus
[`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis).

---

## Die Regel, um die es geht

**Ruf ist keine Zahl, die jemand pflegt.** Er ist das, was übrig bleibt,
nachdem etwas passiert ist. Eine gespeicherte Ruf-Zahl driftet von der
Geschichte weg, und dann steht am Tisch eine Zahl, die niemand belegen kann —
„warum hasst uns das Auge eigentlich?" ist die Frage, die sie nicht
beantworten kann.

Also wird er **beim Lesen gerechnet und nie gespeichert** (D8), aus zwei
Sorten Zeile:

| Zeile | Was sie sagt |
|---|---|
| `regards` (Kante, mit `value` und `note`) | Wo jemand **anfängt**, bevor etwas passiert ist |
| `Deed` (Artikel, mit `DeedInfo.delta`) | Was **passiert** ist, und wie schwer es wog |

`standing(A → B)` = Ausgangswert von A gegenüber B, plus die Gewichte aller
Taten, die B getan hat und die A betreffen — begrenzt auf −3 bis +3.

---

## Warum eine Tat ein Artikel ist

Eine Tat ist **dreistellig**: wer hat was bei wem getan. Eine Kante hat aber
ein Ziel. Das Rückgrat kennt dafür genau eine Antwort, und es ist dieselbe wie
beim Rezept und bei der Begegnung: **die Mitte wird ein Artikel.**

```
Deed «Floon aus dem Lampenkeller geholt»
  DeedInfo { delta: −2, kind: "slight", secret: false }
  ──doneBy──────→ Die Nebelwacht
  ──regarding───→ Das Auge
```

Das Gewicht steht am Artikel, die beiden Enden an Kanten. Wanderte das Gewicht
an eine der Kanten, wäre die dritte Stelle wieder verloren.

Und es zahlt sich sofort aus: eine Tat lässt sich **beschreiben**, **datieren**
(`WorldDate`), auf die **Zeitleiste** legen, als Teil einer Geschichte
einordnen (`partOf`) — und **verbergen**.

---

## Der eigentliche Punkt: eine Tat, von der niemand weiss, ändert nichts

`DeedInfo.secret` heisst nicht „geheim für die Spieler". Es heisst: **die
Gegenseite weiss es nicht.** Und solange sie es nicht weiss, bewegt die Tat
ihren Ruf nicht.

Ob sie es weiss, beantwortet **das Wissensmodell, das schon da ist**: eine
`knowledge`-Kante von der Tat auf eine Information, und diese Information ist
der Gegenseite über `knownBy` zugeteilt — oder nicht. Keine zweite Mechanik
für dieselbe Frage.

Damit „das Auge hat es erfahren" überhaupt sagbar ist, darf eine **Fraktion**
Wissensträger sein (`knownBy.to` enthält `Faction`). Das ist die einzige
Registerzeile, die dieser Mechanismus verändern musste.

Wenn die Gegenseite es erfährt, zählt die Tat **rückwirkend** — sie ist ja
passiert. Das ist keine Nachlässigkeit, sondern wie es am Tisch zugeht: der
Diebstahl von letzter Woche ändert heute alles.

Der Spielleitung wird gesagt, dass da etwas liegt („2 deeds nobody found out
about — not counted"). Den Spielern nicht einmal die Anzahl: das wäre genau
die bekannte Unbekannte (REQ-179), die hier keine sein soll.

---

## Zwei Richtungen, ein Paar Kanten (REQ-081)

`regards` wird nur vorwärts gespeichert, wie jede Kante. Die Gegenrichtung ist
eine Abfrage — und **beide werden gezeigt**, wenn sie sich unterscheiden. Genau
da wird es interessant: das Auge ist der Wacht Todfeind (−3), die Wacht hält
das Auge bloss für gefährlich (−2). Einer traut, der andere nicht.

Vorn steht immer das Urteil **dieses** Artikels über die Gegenseite — das ist
die Frage, die man auf dieser Seite stellt.

---

## Was `CreatureInfo.attitude` damit zu tun hat: nichts

Die Grundhaltung gegenüber Fremden (`freundlich`, `neutral`, `feindlich`) ist
ein **Wort** und kein Zähler, und sie zeigt auf niemanden — also bleibt sie ein
Feld. Richtig so. Sie sagt, wie jemand reagiert, den man noch nie getroffen
hat. Was auf jemanden zeigt, ist `regards`; was daraus folgt, wird gerechnet.

Die Prüfung hält beides auseinander: kein Feld heisst `standing` oder
`reputation`, und `attitude` bleibt eine Aufzählung.

---

## Die Leiter

Sieben Stufen, weil man sieben am Tisch aussprechen kann und einundzwanzig
nicht:

| −3 | −2 | −1 | 0 | +1 | +2 | +3 |
|---|---|---|---|---|---|---|
| sworn enemy | hostile | wary | neutral | friendly | trusted | sworn ally |

---

## Die Zeilen

| Art | Name | Zweck |
|---|---|---|
| Komponente | `DeedInfo` | `delta`, `kind`, `secret` |
| Schnittstelle | `Deed` | verlangt `Name`, `DeedInfo` |
| Kante | `doneBy` | Tat → Täter |
| Kante | `regarding` | Tat → wessen Meinung sich bewegt |
| Kante | `regards` | Urteilender → Beurteilter, `props.value`, `props.note` |
| Ansicht | `standing` | die Leiter und was sie bewegt hat |

---

## Schaudaten

- **Das Auge** fängt bei −1 gegenüber der Wacht an („Fremde, die Fragen
  stellen"). Dass Floon wieder draussen ist, kostet −2 — also −3, Todfeind.
- **Volothamp** fing bei 0 an und rechnet es der Wacht mit +2 an, dass sie ihn
  aus dem Schleimgang gezogen hat.
- **Rook** hat dem Auge drei Fläschchen Nebelessenz abgenommen. Es war niemand
  da, der es gesehen hat: die Tat liegt bei −2 und zählt **nicht**. Das Auge
  steht zu Rook auf neutral. Wer die Information „Wer die Essenz genommen hat"
  dem Auge zuteilt, sieht die Zahl auf −2 fallen — rückwirkend.

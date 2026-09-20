# Karten: Zeichenebenen, Sperren, Unterkarten

Stand 2026-09-20. REQ-130 bis 140 und REQ-193 aus
[`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis).

---

## Achtung, ein Wort für zwei Dinge

„Ebene“ heisst in diesem Projekt zweierlei, und wer die beiden verwechselt,
sucht den Fehler an der falschen Stelle:

- **Inhaltsebene** — `Layer` mit `LayerInfo`, der Stapel aus
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

**Das unterste Blatt ist das Kartenbild selbst** (`MapInfo.image`) und hat
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

Eine Liste, zwei Fragen. `MapInfo.walls` hiess einmal „Sichtblocker“ und
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

## Was noch fehlt

- **Stufenloses Zoomen** in den Rahmen hinein statt eines Sprungs auf den
  Artikel der Unterkarte.
- **Assets platzieren**: Möbel, Bäume, Türen als Bilder mit Drehung und
  Grösse, statt nur Tokens, die auf Artikel zeigen.
- **Bewegung**, die `mapBarriers` auch auswertet.

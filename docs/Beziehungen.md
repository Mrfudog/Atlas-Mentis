# Beziehungen

Stand 2026-09-20. REQ-030 und REQ-081 aus
[`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis).

---

## Was hier stand und warum es weg ist

Hier lag einmal ein ausgewachsenes Ruf-System. Eine **Tat** war ein eigener
Artikel mit einem Gewicht von −3 bis +3 und zwei Kanten — `doneBy` auf den
Täter, `regarding` auf den, dessen Meinung sich bewegte. Dazu ein
Ausgangswert, eine gerechnete Leiter mit sieben Stufen, und die Regel, dass
eine Tat, von der niemand weiss, nichts ändert, bis die Gegenseite davon
erfährt.

Es war richtig gebaut. Die dreistellige Tatsache („wer hat was bei wem
getan") wurde zum Artikel, wie beim Rezept und bei der Begegnung; das
Geheimhalten lief über das Wissensmodell statt über eine zweite Mechanik;
nichts war gespeichert, was sich rechnen liess.

Und es war trotzdem zu viel. Am Tisch fragt niemand nach einer Zahl. Man
fragt „was hält das Auge von euch?", und die Antwort ist ein Satz. Um dahin
zu kommen, musste man vorher drei Artikel anlegen.

---

## Was geblieben ist

**Eine Kante mit Marken.** `regards` zeigt von dem, der urteilt, auf den,
über den geurteilt wird, und trägt:

- `tags` — die Gedanken. Worte, keine Aufzählung im Register.
- `note` — eine Zeile, warum.

Das war's.

Die Marken sind absichtlich **keine Aufzählung**. Was jemand vom anderen
hält, ist Kampagneninhalt — „schuldet mir was", „misstraut mir seit
Nashkel", „hat mich rausgeholt". Eine feste Liste hätte entweder zwanzig
Einträge oder die falschen drei.

---

## Zwei Sachen, die bleiben, weil sie nichts kosten

**Die Kante steht beim Urteilenden.** „Das Auge hält von euch nichts" ist
eine Aussage über das Auge, nicht über euch. Wer sie beim Beurteilten
ablegte, müsste beim Lesen eines Artikels alle anderen durchsuchen, um zu
wissen, was er selbst denkt.

**Die Gegenrichtung ist eine eigene Kante** und darf etwas ganz anderes
sagen (REQ-081). Genau da wird es interessant: Volo ist dankbar, die
Wacht hält ihn für einen Schwätzer. Beides steht, und keines widerspricht
dem anderen.

Auf der Seite steht deshalb vorn, was *dieser* Artikel denkt, und darunter
mit einem `↩`, was zurückgedacht wird. Bearbeiten lässt sich die
Gegenrichtung dort nicht — wer das könnte, schriebe in einen fremden
Artikel, ohne ihn zu sehen.

---

## Bedienung

Eine Marke ist ein Knopf: anklicken nimmt sie weg. `+` setzt eine dazu.
Eine Marke, die man nur über einen Dialog loswird, bleibt stehen.

Eine Kante ohne Marken und ohne Zeile ist keine Beziehung und wird
gelöscht, statt als leere Zeile stehenzubleiben.

---

## Was der Verzicht kostet

Ehrlich gesagt: **„eine Tat, von der niemand weiss, ändert nichts"** war
der beste Teil des alten Modells, und er ist weg. Wer eine Beziehung jetzt
geheim halten will, muss den Artikel oder das Feld zurückhalten — das
Wissensmodell trägt das, aber es ist nicht mehr dieselbe Mechanik.

Auch weg: die Datierung einer Tat und ihr Platz auf der Zeitleiste. Wer
festhalten will, *wann* sich etwas drehte, schreibt es als Ereignis und
setzt die Marke dazu.

Zurückholen ist eine Registerzeile und ein Dialog. Wenn es fehlt, kommt es
zurück.

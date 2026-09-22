# Wissen — wer weiss was

Stand 2026-09-20. Das ist A6 aus dem [Fahrplan](Roadmap.md), gebaut nach
Entscheidung 4: *„Wissen: selbst festlegen, über ein Seitenpanel in der
Artikelansicht."*

---

## Die Einheit dazwischen

Ein Artikel trägt Felder und Textblöcke. Manches davon liegt offen, manches
nicht — und *wer* was weiss, ist nicht für alle gleich. Die naheliegende
Lösung wäre ein Attribut am Feld: „geheim, ausser für Mara". Sie trägt nicht.
Ein Attribut fasst einen Empfänger, nicht drei. Es ist nicht abfragbar — „wer
weiss vom wahren Namen des Barons?" müsste jedes Feld jedes Artikels
durchsuchen. Und es kann nicht mehrere Felder zusammenhalten, die nur
gemeinsam Sinn ergeben.

Deshalb gibt es eine Einheit dazwischen: die **Information**. Sie bündelt
Felder und Blöcke eines Artikels und wird als Ganzes zugeteilt.

Und weil sie Kanten tragen muss, ist sie ein **eigener Artikel** — im
Rückgrat trägt nur ein Peg Kanten. Damit ist „wer weiss davon?" ein Rückbezug
wie jeder andere, und eine Information kann selbst eine Beschreibung, einen
Stand und Marken haben.

```
Artikel      --knowledge-->  Information        (owned)
Information  --knownBy-->    Creature | Party | Faction | KnowledgeLevel | Group
Creature     --atLevel-->    KnowledgeLevel
```

Drei Kantenarten und zwei Artikelarten. Kein neues Konstrukt.

---

## Die Zeilen

| Zeile | Art | Was sie sagt |
|---|---|---|
| `Information` | Schnittstelle | erweitert `Base`, verlangt `Information` |
| `KnowledgeLevel` | Schnittstelle | erweitert `Base`, verlangt `KnowledgeLevel` |
| `Information` | Felder der Art | `fields[]`, `blocks[]`, `tier` |
| `KnowledgeLevel` | Felder der Art | `scope`: common / group / personal |
| `knowledge` | Kante | Artikel → Information, `owned` |
| `knownBy` | Kante | Information → Geschöpf, Gruppe, Wissensstand |
| `atLevel` | Kante | Geschöpf, Gruppe → Wissensstand |
| `knowledge` | Ansicht | Layout aus Beschreibung + Wissensgruppen |

`Information.fields` schreibt Feldverweise in derselben Schreibweise wie die
Ansichten: `Abilities` nimmt jedes Feld dieser Art, `Statblock.ac`
genau ein Feld. Zwei Schreibweisen für dieselbe Sache wären eine zu viel.

`tier` ist **nur Anzeige und Sortierung**. Was jemand sehen darf, entscheiden
die Kanten. Ein Rang, der es mitentscheidet, wäre eine zweite Quelle, die der
ersten widersprechen kann.

---

## Die Kante hängt am Artikel, nicht an der Information

`knowledge` wird auf dem Artikel gespeichert: `Baron → knowledge →
„Sein wahrer Name"`. Zwei Gründe.

Erstens liegt die Liste damit dort, wo das Seitenpanel sie bearbeitet.
Zweitens greift `owned`: löscht man den Artikel, sterben seine Bündel mit,
statt als Information über nichts zurückzubleiben.

`knownBy` hängt umgekehrt an der **Information**, nicht am Empfänger. Sonst
müsste jede Figur eine Liste dessen pflegen, was sie weiss — und etwas zu
entziehen hiesse, es dort wiederzufinden. So ist Zuteilen eine Kante mehr,
Entziehen eine weniger, und beides fasst den Artikel nicht an: dass jemand
etwas erfährt, ändert den Baron nicht.

---

## Was offen ist, ist offen

**Ein Feld, das keine Information nennt, liegt offen.**

Die Umkehrung — alles zu, bis jemand es freigibt — ist sicherer, und sie wäre
die falsche Wahl. Sie macht jede neue Zeile unsichtbar, bis jemand daran
denkt, und eine Spieleransicht, die standardmässig leer ist, benutzt niemand.
Nach zwei Sitzungen hätte jemand eine Information „Alles" angelegt und sie an
alle gehängt, und dann wäre die Regel wieder da, wo sie jetzt ist — nur
unsichtbar.

Der Preis ist ein Vergessen, das leckt. Dagegen steht, dass die Wissensansicht
die **offene Gruppe zuoberst** zeigt: man sieht immer, was gerade offen liegt,
statt es erschliessen zu müssen.

> Die Sichtbarkeit des *ganzen* Artikels regeln weiterhin die Felder
> `Visibility`. Wissen verfeinert innerhalb eines Artikels, den jemand
> ohnehin sehen darf. Die beiden schliessen einander nicht aus: was
> `Visibility` verbirgt, erreicht kein Wissen.

---

## Auflösung

Was ein Betrachter weiss, ist immer eine Abfrage — nie ein gespeicherter Wert
(D8):

```
kennt(Betrachter, Information) :=
      Information --knownBy--> Betrachter
   ∨  Information --knownBy--> L  ∧  Betrachter --atLevel--> L
   ∨  Information --knownBy--> P  ∧  Betrachter --memberOfParty--> P
   ∨  Information --knownBy--> L  ∧  Betrachter --memberOfParty--> P
                                  ∧  P --atLevel--> L
```

Einen Schritt weit, nicht transitiv. Ein Wissensstand, der einem anderen
angehört, wäre eine Hierarchie — die hat niemand verlangt, und sie liesse sich
nachrüsten, ohne eine Zeile zu ändern.

**Ein Betrachter ist eine Liste, keine Id.** Ein Konto führt mehrere Figuren,
und wer zwei spielt, weiss am Tisch, was beide wissen — eine Seite, die ihm
das eine vorenthält, während er auf das andere schaut, zwingt ihn zum
Umschalten und sonst zu nichts. Gerechnet wird über die Vereinigung.

Eine **leere** Liste ist dabei nicht dasselbe wie **keine**: `undefined`
heisst Spielleitung und sieht alles, `[]` heisst ein Konto ohne Figur und
sieht genau das Offene.

---

## Die Gruppe

`Party` ist ein Figurengefüge: Rook, Sela und der Rest ziehen zusammen los.
Wissen an die Party zu geben erreicht jedes Mitglied über `memberOfParty`,
und das ist richtig so.

Es deckt aber nur die Abenteuergruppe ab. **„Die Spieler dieser Kampagne"
ist etwas anderes** — wer noch keine Figur hat, wer gerade eine neue baut,
wer als Gast zusieht, steht in keiner Party und soll dasselbe erfahren.

Dafür gibt es `Group`. Sie trägt kein Blatt, keine Werte
und keine Ausrüstung; sie ist da, damit Wissen einen Empfänger hat, der
grösser ist als eine Figur und anders als eine Party.

**Ihre Mitglieder sind Konten, nicht Figuren.** Ein Konto zeigt auf sie wie
auf eine Figur — dieselbe Zeile in `app_user_actor`, derselbe Eintrag in der
Betrachterliste. Genau deshalb ist sie keine zweite Mechanik, sondern ein
dritter Halter im selben Verfahren.

Ohne Betrachter ist es die Spielleitung: sie sieht alles.

Der Code steht in `packages/model/src/knowledge.ts` (`knows`,
`knowledgeGroups`, `visibleFields`) und, in derselben Form, im Prototyp. Beide
sind geprüft — sechs Vitest-Fälle und sechs Prüfungen im Playwright-Lauf.

---

## Die Oberfläche

**Die Ansicht „Knowledge"** zeigt den Artikel nach Informationen geordnet:
zuoberst „Open" mit gestricheltem Rand, darunter je ein Kasten pro
Information. Jeder Kasten nennt in seiner Kopfzeile den Rang und die
Empfänger. Die Felder sind dort so bearbeitbar wie in jeder anderen Ansicht.

**Das Seitenpanel** hat zwei Reiter, „Relations" und „Knowledge". Im zweiten:
eine Information wählen oder anlegen, ihren Rang setzen, Felder und Blöcke
ankreuzen, Empfänger zuteilen und wieder entziehen. Ein Feld, das schon in
einer anderen Information steht, ist grau und sagt es im Tooltip — verboten
ist es nicht, denn dasselbe Feld kann auf zwei Wegen bekannt werden.

---

## Was noch offen ist

1. **Die Spieleransicht selbst.** `visibleFields` liegt bereit, aber es gibt
   noch keinen Zugang, der sie benutzt — dafür braucht es die Anmeldung
   (Entscheidung 2, ein Passwort je Nutzer). Solange steht die Auflösung
   geprüft, aber ungenutzt da.
2. **Blöcke haben keinen stabilen Anker.** Zugeteilt wird über die Block-Id.
   `Block.anchor` ist im Modell vorgesehen, wird aber noch nicht vergeben.
   Wer einen Block löscht und neu schreibt, muss ihn neu zuteilen.
3. **Wissen an Kanten und Bausteinen.** Eine Information bündelt heute Felder
   und Blöcke. Ob eine *Verbindung* („der Baron kennt Floon") ebenso
   zuteilbar sein soll, ist nicht entschieden.
4. **Wissensstände über mehrere Kampagnen.** `KnowledgeLevel.scope` steht
   schon da, wird aber von nichts gelesen.

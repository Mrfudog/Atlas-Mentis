# Karten: Vergleich mit anderen VTTs (T-203, Schritt 0)

Stand 15.10.2026. Grundlage für die Überarbeitung der Karte
(`apps/web/src/app/karten/karte.ts`): was andere virtuelle Spieltische
an der Karte anbieten, was davon wir übernehmen, was nicht — und warum.
Beschrieben in eigenen Worten nach öffentlich bekanntem Funktionsumfang;
keine Bilder, keine Texte der Produkte. Die Produkte ändern sich, die
Tabelle ist eine Momentaufnahme und kein Datenblatt.

Verglichen: **Foundry VTT**, **Roll20**, **Owlbear Rodeo**, **Shard
Tabletop**, **Alchemy**, **Fantasy Grounds**.

## Wer was ist, in einem Satz

- **Foundry VTT** — selbst betrieben, sehr vollständig: eine senkrechte
  Werkzeugleiste links mit Gruppen (Tokens, Messen, Kacheln, Zeichnen,
  Wände, Licht, Töne, Notizen, Regionen), jede Gruppe klappt ihre
  Unterwerkzeuge daneben auf. Wände mit Türen, Sicht und Licht gerechnet.
- **Roll20** — im Browser, Ebenen *Karte / Objekte / GM / Dynamic
  Lighting* als Umschalter in der Leiste links; Spielende ziehen frei,
  die Leitung kann Tokens auf der GM-Ebene vorbereiten.
- **Owlbear Rodeo** — bewusst schlank: wenige Werkzeuge (Bewegen,
  Messen, Zeichnen, Nebel, Notizen, Zeiger), Erweiterungen statt
  eingebauter Regeln, Notizen als Zettel auf der Karte.
- **Shard Tabletop** — Bogen und Karte eng verzahnt; Begegnungen werden
  vorbereitet und mit einem Klick auf die Karte gebracht, Initiative
  läuft gleich mit.
- **Alchemy** — Stimmung zuerst (Szenen, Musik, Bild), die Karte ist ein
  Teil der Szene; Werkzeuge reduziert, Sitzungsinhalt in einer Leiste.
- **Fantasy Grounds** — regelstark, viele Fenster; Begegnungen werden im
  „Combat Tracker“ vorbereitet und ihre Tokens auf der Karte vorplatziert,
  sichtbar erst, wenn die Leitung sie freigibt.

## Was es gibt, und was wir tun

| Thema | So machen es andere | Wir | Warum |
|---|---|---|---|
| **Werkzeugleiste** | Foundry: senkrecht links, Gruppen mit Unterwerkzeugen. Roll20: ähnlich, mit Ebenenwahl. Owlbear: kurze Leiste oben, wenige Werkzeuge. | **Übernehmen** — senkrecht links, sieben Gruppen: Auswahl · Tokens · Messen · Nebel · Wände · Notizen · Zeichnen; die aktive Gruppe zeigt ihre Unterwerkzeuge in einer zweiten Leiste. Am Telefon waagrecht unten. | Die Knöpfe standen verstreut in einer Zeile über der Karte und brachen bei jedem neuen Werkzeug um. Gruppen halten die Leiste kurz und sagen, wohin das nächste Werkzeug gehört. |
| **Tastenkürzel** | Foundry und Owlbear: ein Buchstabe je Werkzeug, Esc zurück zur Auswahl. | **Übernehmen** — ein Buchstabe je Gruppe (S, T, M, F; später W, N, D), Esc, Umschalt+F für Vollbild. Steht im Tooltip. | Wer den Kampf leitet, schaut auf die Karte, nicht auf die Leiste. |
| **Vollbild** | Alle: die Seite bekommt das ganze Fenster, Leisten lassen sich einklappen. | **Übernehmen** — Fullscreen API, Esc verlässt; Werkzeugleiste und Seitenleiste einklappbar. | Am Beamer und am Telefon ist jeder Rand verlorene Karte. |
| **Ebenen** | Roll20: Karte, Objekte, GM-Ebene als Wahl. Foundry: je Werkzeuggruppe eine Ebene. | **Haben wir anders** — Blätter (Zeichenebenen) mit `gmOnly`, Marker mit `hidden`. Keine eigene GM-Ebene. | Was die Spielenden nicht sehen, hält der Server zurück (`redactMap`); eine Ebene, die nur in der Oberfläche verbirgt, wäre eine zweite Prüfung. |
| **Wände und Türen** | Foundry: Linien mit Art (Wand, Tür, Fenster, unsichtbar), Türen auf/zu/verschlossen. Roll20: Dynamic Lighting mit Linien. | **Haben wir** (T-118) — Gruppe *Walls*: Wand, Tür, Geheimtür, Fenster, Hindernis, unsichtbare Wand; je Art hält sie Bewegung, Sicht, Licht (wie Foundry). Türen auf/zu/verschlossen, Spielende öffnen an ihrer Figur. [Karten.md](../Karten.md#sperren-wand-tür-fenster-abgrund). | Die Leitung wollte Türen, die man öffnet und die nach Sichtlinie aufdecken. |
| **Sicht und Licht** | Foundry und Roll20 rechnen Sichtlinien gegen Wände, Lichtquellen mit Radius. Owlbear: Dynamic Fog. | **Sicht haben wir** (T-118): ein Zug und eine geöffnete Tür decken das Sichtpolygon auf, gemerkt im Nebel. **Licht später.** | Licht braucht Radien am Marker und Dunkelsicht aus dem Statblock — ein eigener Schritt. |
| **Nebel** | Foundry: aus Sicht gerechnet und gemerkt. Owlbear/Roll20: von Hand aufdecken mit Rechteck oder Pinsel. | **Haben wir** (T-117, T-204) — von Hand, je Figur, beim Zug aufdecken. Wandert in die Gruppe *Nebel* der Leiste. | Bleibt; die Leiste ordnet nur. |
| **Notizen** | Foundry: ein Notizsymbol, das auf einen Journal-Eintrag zeigt. Owlbear: Zettel mit Text direkt auf der Karte. | **Übernehmen, in zwei Schritten** — Gruppe *Notizen* in der Leiste; ein Antippen legt eine Notiz an (Artikel mit Text, Sichtbarkeit Leitung oder Spielende) und setzt sie als Marker. | Eine Notiz als Artikel hält die Sichtbarkeit am Server und taucht in der Suche auf; ein Zettel nur auf der Karte wäre ein zweiter Ort für Text. Folgeaufgabe. |
| **Markerdarstellung** | Foundry: Token-Bild, Name auf Wunsch. Roll20: Bild mit Leiste. Owlbear: Bild oder Text-Etikett. | **Übernehmen** — je Marker und Kartenart wählbar: Symbol, Name, Bild oder Kurzansicht-Karte; Vorgabe an der Art, wie die Ansichten. | Eine Stadtkarte will Namen, eine Kampfkarte Bilder. Folgeaufgabe. |
| **Spielende neben der Karte** | Shard, Alchemy: Figuren mit Trefferpunkten in einer Leiste. Foundry: Spielerliste unten links. | **Übernehmen** — Seitenleiste rechts: Figuren der Kampagne mit HP und Zuständen, „auf Karte zentrieren“, „aufs Feld ziehen“. | Die Leitung braucht die Zahlen beim Kampf, ohne die Karte zu verlassen. |
| **Begegnungen der Sitzung** | Shard, Fantasy Grounds: vorbereitete Begegnungen mit Start-Knopf. | **Übernehmen** — in derselben Seitenleiste: Begegnungen der Sitzung, Teilnehmer, „Start“. | Steht schon an der Sitzung; der Weg dorthin fehlt nur auf der Karte. |
| **Vorplatzieren** | Fantasy Grounds: Tokens einer Begegnung vorab gesetzt, unsichtbar bis zur Freigabe. Roll20: auf der GM-Ebene. | **Übernehmen** — Teilnehmer einer nicht laufenden Begegnung setzen; nur die Leitung sieht sie, blass; „Start encounter“ macht sie zu Spiel-Tokens und würfelt Initiative. | Wer den Kampf vorbereitet, will ihn nicht am Tisch aufbauen. Gesiebt am Server, nicht in der Maske. |
| **Zugbestätigung** | Meist keine: Spielende ziehen frei, die Leitung schiebt zurück. Einige Erweiterungen bieten Bestätigung. | **Haben wir** (T-198, T-204) — Zugplan im Kampf, Vorschläge mit ✓/✗ ausserhalb. | Die Leitung entscheidet, was am Tisch gilt. |
| **Zeichnen** | Foundry, Owlbear, Roll20: Freihand, Formen, Text auf der Karte. | **Später** — Gruppe steht in der Leiste, ohne Werkzeug. | Braucht ein Speicherformat (Blatt oder Form); keine Anforderung drängt. |
| **Zeiger / Ping** | Owlbear, Roll20, Foundry: kurzes Aufleuchten an einer Stelle für alle. | **Nicht jetzt** | Braucht den Live-Kanal mit flüchtigen Ereignissen; gut als eigene Story. |
| **Kacheln / Möbel** | Foundry: Kacheln mit Drehung und Höhe. | **Haben wir anders** — Möbel als Marker der Art `scenery`. | Siehe [Karten.md › Möbel statt Tokens](../Karten.md#möbel-statt-tokens). |
| **Töne, Musik** | Foundry, Alchemy: Klangquellen auf der Karte. | **Nicht** | Gehört nicht zur Karte dieser Runde; kein Wunsch der Leitung. |

## Was daraus folgt

1. **Werkzeugleiste links mit Gruppen**, Tastenkürzel, Vollbild — die
   Knöpfe von heute ziehen um, nichts fällt weg (erster Teil von T-203).
2. **Seitenleiste** mit Spielenden und Begegnungen der Sitzung.
3. **Vorplatzieren** der Teilnehmer einer Begegnung.
4. **Notizen** und **wählbare Markerdarstellung** — als Folgeaufgabe.
5. Wände, Sicht, Licht: T-118. Zeichnen und Zeiger: noch keine Aufgabe.

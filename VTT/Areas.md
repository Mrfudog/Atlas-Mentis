---
tags: [vtt, epics, view]
aliases: [Epics]
status: derived
updated: 2026-10-22
---

# Epics

> [!info] Erzeugt aus den Notizen
> Quelle sind die Story-Notizen in `VTT/Stories/`, die Features in `VTT/Features/`, die Epics in `VTT/Epics/`.
> `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md` schreibt diese Seite neu — von Hand geändert wird die Notiz, nicht die Seite.

Die Funktionsbereiche von früher sind die **Epics** (E-049): je Epic ein Bereich mit seinem Umfang, darin die Features — einzelne Funktionen, Artikelarten oder Ansichten. Die Bereiche der App (World, Story, Rules, Play, Register …) sind Features in ihrem Epic, z. B. „Bereich World“ in Welt & Lore. Der Querschnitt (früher „Cross-cutting“) ist auf die passenden Epics verteilt.

| Epic | Umfang | Features | Stories | Punkte | Stand |
|---|---|---|---|---|---|
| [[EP-01 Inhaltsgerüst]] | Register, Arten, Felder, Kanten, Ebenen und Fassungen, Ansichten — das Modell, mit dem jeder Artikel beschrieben, gespeichert und gezeichnet wird. | 9 | 53 | 177 | 33 steht · 10 teils · 4 offen · 4 ersetzt · 2 verworfen |
| [[EP-02 Zugang & Betrieb]] | Konten, Rollen je Kampagne, Sichtbarkeit und Wissen, Schreibrechte, API-Tokens, Werkbank, Ausrollen, Sicherung, Übernahme zwischen dev und prod, Leistung. | 11 | 45 | 139 | 28 steht · 6 teils · 8 offen · 1 ersetzt · 2 verworfen |
| [[EP-03 Kreaturen & Figuren]] | Kreatur, Statblock (Vorlage und Instanz), Charakterbogen und Charaktermanager — alles, was eine Figur oder ein Monster beschreibt. | 5 | 29 | 122 | 18 steht · 2 teils · 8 offen · 1 ersetzt |
| [[EP-04 Spielererlebnis]] | Was Spielende sehen und tun: Spieleransicht und Telefon, eigene Figur und eigene Inhalte, Inventar, Chat. | 6 | 42 | 109 | 7 steht · 10 teils · 25 offen |
| [[EP-05 Kampagne & Sitzungen]] | Kampagnenmanager, Bereich Story (Arcs, Quests, Szenen), Sitzungen und Vorbereitung, Begegnungen, Abenteuer übernehmen, Party, Ladebildschirm. | 8 | 31 | 106 | 17 steht · 3 teils · 11 offen |
| [[EP-06 Welt & Lore]] | Bereich World: Orte, Fraktionen, Gottheiten, Lore, Kalender und Zeitleisten, Beziehungen, Läden und Wirtschaft. | 5 | 17 | 63 | 8 steht · 1 teils · 6 offen · 2 ersetzt |
| [[EP-07 Regeln & Nachschlagen]] | Bereich Rules und Kompendium, Bücher und Leseansicht, Klassen, Zauber, Zustände, Handwerk, Regelsysteme und die Auswertung von Regeln. | 8 | 27 | 126 | 13 steht · 2 teils · 12 offen |
| [[EP-08 Live-Spiel]] | Bereich Play: Spielleiter-Schirm, Initiative, Sitzungszustand und Live-Kanal, Würfel, Werkzeuge am Tisch. | 5 | 33 | 119 | 14 steht · 6 teils · 12 offen · 1 ersetzt |
| [[EP-09 Karten]] | Karte und Kartenebenen, Tokens und Marker, Nebel, Licht und Sicht, Bewegung und Zonen, Gebiete, Reisen, Karteneditor. | 7 | 28 | 124 | 18 steht · 6 teils · 4 offen |
| [[EP-10 Medien & Assets]] | Bilder und Dateien: Ablage, Bildverwaltung und Bildklassen, Token-Werkstatt, Druck und Ausfuhr, PDF. | 5 | 21 | 81 | 4 steht · 3 teils · 14 offen |
| [[EP-11 Oberfläche & Navigation]] | Boards, Suche, Filter und Filtergruppen, Navigation und Kurzansicht, Bearbeiten in der Ansicht, Design und Stilkonzept. | 6 | 31 | 109 | 20 steht · 6 teils · 4 offen · 1 ersetzt |
| [[EP-12 Import & Inhalte]] | 5e.tools, Regelwerke anderer Verlage, Obsidian-Vault, Artikelprüfung und KI-erzeugte Inhalte — wie Inhalte hereinkommen und vollständig werden. | 5 | 10 | 39 | 5 steht · 2 teils · 1 offen · 2 verworfen |

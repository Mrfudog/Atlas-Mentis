## Was

<!-- Eine Zeile: was diese Änderung tut. -->

## Warum

<!-- Der Anlass. Wenn es eine Anforderung gibt, verlinke sie: REQ-174. -->

## Wie geprüft

<!-- CLAUDE.md › Grundanforderungen an jede Änderung. Fehlt eine Stufe, hier sagen warum. -->

- [ ] `pnpm test`: Unit
- [ ] Integration: Route über `app.inject`, Leitung und Spielerin
- [ ] Durchstich gegen Postgres, bei Migration auch mit Bestand (Altdaten, die sie umstellt)
- [ ] E2E: `apps/web/e2e/`, 1360 und 390 px
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] Nach dem Merge: Ausrollen auf dev grün, `/api/health` 200

## Leistung

<!-- docs/Performance.md, Regeln P1–P8. Ändert sich ein Ladepfad (neuer Abruf, neuer Effekt, der fragt, neue Seite), hier die Abrufe vorher → nachher. -->

- [ ] Kein Abruf je Element, keine doppelte Frage (P1, P2)
- [ ] Am Server kein Durchlauf über den Bestand je Artikel, kein Index, der bei jedem Schreiben verfällt (P4, P5)
- [ ] Startpaket nicht gewachsen, Budget nicht angehoben (P6)
- [ ] Neuer Ladepfad in `apps/web/e2e/abrufe.spec.ts` (P8); Abrufe vorher → nachher:
- [ ] nicht nötig (kein Ladepfad geändert)

## Vault

- [ ] Feature-Notiz und Story nachgeführt (`VTT/Features/`, `VTT/Stories/`)
- [ ] Diagramm, wo mehr als drei Teile zusammenspielen
- [ ] nicht nötig (keine Funktion geändert)

## What's new

<!-- Sichtbare Änderung → Eintrag oben in apps/web/src/whats-new.json (CONTRIBUTING.md › What's new ergänzen). -->

- [ ] Eintrag in `apps/web/src/whats-new.json` ergänzt
- [ ] nicht nötig (keine sichtbare Änderung)

## Handbuch und Glossar

<!-- CONTRIBUTING.md › Handbuch und Glossar nachziehen: Hilfetext, does, APP_TERMS, handbook.json. Die Tests nennen, was fehlt. -->

- [ ] Hilfetext, Regeloption, Glossar oder Handbuch nachgezogen
- [ ] nicht nötig (nichts, was die Seite erklärt, hat sich geändert)

## Zu beachten

<!-- Migrationen, Registeränderungen, alles was preprod anders macht als main. -->

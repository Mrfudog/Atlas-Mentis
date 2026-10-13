-- Der letzte fertige Stand eines Artikels (REQ-237, E-012, E-014 d).
--
-- Ändert eine Spielerin einen Artikel, der `ready` ist, fällt er auf
-- `prepared`, und für alle anderen gilt weiter der Stand davor, bis die
-- Leitung wieder `ready` setzt. Dieser Stand steht hier als Kopie — nicht
-- als zweite Karte im Artikel: sonst wanderte er mit jeder Ausfuhr mit,
-- und jede Prüfung müsste zwei Fassungen kennen.
--
-- `entity_id` ohne Fremdschlüssel wie `app_user_article`: der Server
-- räumt die Zeile beim Löschen und beim Fertignennen weg, und eine, die
-- auf nichts mehr zeigt, tut niemandem etwas. `ready_at` ist, wann der
-- fertige Stand geschrieben wurde — das Datum im Band.
create table if not exists entity_ready (
  entity_id text primary key,
  data      jsonb not null,
  ready_at  timestamptz not null default now()
);

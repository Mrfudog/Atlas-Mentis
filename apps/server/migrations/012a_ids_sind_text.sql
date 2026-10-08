-- **Die Kette lief nie gegen eine echte Datenbank.** Gefunden am 2026-10-01,
-- als sie für das Hosting zum ersten Mal auf einer frischen Postgres lief.
-- Die Prüfungen laufen gegen `InMemoryRepository`, und der kennt weder
-- Spaltentypen noch Fremdschlüssel. Drei Dinge passten deshalb nicht:
--
-- 1. **Die Ids waren `uuid`.** Ein Artikel heisst aber `pc_sela`, `ly_system`
--    oder `e_6dfynbg`, eine Kante `rel_sb_…`, ein Konto `u_…` — kein
--    einziger davon ist eine UUID. Schon der erste Artikel wäre beim
--    Speichern abgewiesen worden, und `appendEvent` beim ersten Anmelden.
--    Der Peg ist „eine undurchsichtige Id und sonst nichts" (D15); ein
--    Format für sie vorzuschreiben ist genau das, was er nicht sein soll.
--
-- 2. **`component.type` zeigte per Fremdschlüssel auf `interface_def`.**
--    `putEntity` schreibt aber neben den Karten eine Karte `__meta` (die
--    Arten des Artikels, seine Zusatzfelder), und `__meta` ist keine
--    Artikelart. Jeder Artikel wäre abgewiesen worden.
--
-- 3. **Dieselben Schlüssel hätten jedes Speichern des Registers verhindert**,
--    sobald es Artikel gibt: `saveRegistry` löscht die Zeilen eines Teils
--    und schreibt sie neu, und `delete from interface_def` scheitert an
--    jeder Karte, die auf eine Zeile zeigt. Ebenso `relation_type_fkey` an
--    jeder Kante. Eine Art aus dem Register zu nehmen, deren Artikel
--    wandern sollen, ginge gar nicht.
--
-- Was ein Artikel tragen darf, prüft `validateEntity` gegen das Register,
-- bevor geschrieben wird — „Schreiben geht durch `validateEntity`". Ein
-- Fremdschlüssel daneben wäre die zweite Stelle für dieselbe Regel, und
-- diese hier war die falsche.
--
-- Bleiben darf `component → entity` und `relation.from_id → entity`, beide
-- mit `on delete cascade`: die Karten und die eigenen Kanten eines Artikels
-- gehen mit ihm, wie im Speicher, wo sie in ihm stehen. `relation.to_id`
-- verliert seinen Schlüssel: im Speicher steht eine Kante beim Ausgang, und
-- wird das Ziel gelöscht, bleibt sie stehen und wird als `dangling_relation`
-- gemeldet. Postgres soll sich verhalten wie das, wogegen geprüft wird —
-- sonst besteht die Prüfung und der Betrieb fällt.
--
-- Diese Datei steht zwischen 012 und 013, weil 013 auf Text-Ids baut. Keine
-- Datei ab 007 ist je irgendwo gelaufen (007 las Spalten, die es nie gab),
-- also verschiebt das keine Geschichte.

alter table component drop constraint if exists component_entity_id_fkey;
alter table component drop constraint if exists component_type_fkey;
alter table relation  drop constraint if exists relation_from_id_fkey;
alter table relation  drop constraint if exists relation_to_id_fkey;
alter table relation  drop constraint if exists relation_type_fkey;

alter table entity    alter column id        type text using id::text;
alter table component alter column entity_id type text using entity_id::text;
alter table relation
  alter column id      type text using id::text,
  alter column from_id type text using from_id::text,
  alter column to_id   type text using to_id::text;
alter table event_log
  alter column id      type text using id::text,
  alter column actor   type text using actor::text,
  alter column subject type text using subject::text;

alter table component add constraint component_entity_id_fkey
  foreign key (entity_id) references entity(id) on delete cascade;
alter table relation add constraint relation_from_id_fkey
  foreign key (from_id) references entity(id) on delete cascade;

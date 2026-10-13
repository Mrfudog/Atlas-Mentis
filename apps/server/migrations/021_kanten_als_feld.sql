-- Kantenarten verloren auf dem Weg durch Postgres zwei Angaben.
--
-- `asField` (an welchem Ende sich eine Kante wie ein Feld liest — der
-- Statblock an der Kreatur, das Inventar an der Gruppe) hatte keine Spalte,
-- und `props` (was eine Kante selbst trägt: die Stufe an `hasClass`, der
-- Rang an `memberOf`) wurde geschrieben, aber nie gelesen. Im Speicher
-- stimmte alles, der Seed brachte es beim Start nie nach (er schreibt nur
-- in eine leere Datenbank), und gemerkt hätte es erst, wer eine Kantenart
-- im Register bearbeitet: das Speichern hätte beides still gelöscht
-- (pg-registry.test.ts erzählt dieselbe Geschichte von `area`).
--
-- Nachgetragen wird, was die Startzeilen sagen (packages/registry,
-- relations.ts): `belongsTo` liest sich an der Kreatur, `carries` an dem,
-- der trägt. Eine Datenbank, in der jemand das schon anders gesetzt hat,
-- gibt es nicht — es gab keine Spalte dafür.

alter table relation_def add column if not exists as_field text;
alter table relation_def drop constraint if exists relation_def_as_field_check;
alter table relation_def add constraint relation_def_as_field_check
  check (as_field is null or as_field in ('from', 'to'));

update relation_def set as_field = 'to'   where type = 'belongsTo' and as_field is null;
update relation_def set as_field = 'from' where type = 'carries'   and as_field is null;

-- Komponenten gibt es nicht mehr. Eine Artikelart trägt ihre Felder selbst,
-- und was mehrere Arten teilten, ist ein Obertyp geworden (D27).
--
-- `requires` und `allows` fallen damit weg: dass eine Karte da sein muss,
-- sagte bei 13 von 18 Einträgen nichts — die verlangte Karte hatte kein
-- einziges Pflichtfeld, und eine leere Karte trägt nichts. Was Pflicht ist,
-- steht jetzt je Feld in `schema.required`.
--
-- Die Karten am Artikel heissen weiter `component`, aber ihr `type` nennt
-- ab hier eine **Artikelart** und keine Komponente. Die Wanderung der Werte
-- macht `prototype/migration/cards-to-types.mjs`; hier steht nur, wohin der
-- Fremdschlüssel zeigt.

alter table component drop constraint if exists component_type_fkey;

alter table interface_def add column if not exists schema jsonb;
alter table interface_def drop column if exists requires;
alter table interface_def drop column if exists allows;

-- Zuletzt, damit ein Fehler weiter oben die Zeilen nicht schon weggeworfen hat.
drop table if exists component_def;

alter table component
  add constraint component_type_fkey foreign key (type) references interface_def(name);

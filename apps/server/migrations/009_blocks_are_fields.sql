-- Ein Textblock ist ein Feld.
--
-- Ein Artikel trug `blocks: [{blockType, body, anchor}]` im Umschlag
-- `__meta`, neben `interfaces` und `adhoc`: Fliesstext, der keinem Feld
-- gehörte, mit einer eigenen Liste erlaubter Arten je Artikelart
-- (`interface_def.block_types`). Das war ein zweites Ding für dieselbe
-- Arbeit — eine Art musste zweimal sagen, was sie festhält, und eine
-- Ansicht zweimal, was sie zeigt.
--
-- Ab hier ist die Blockart das Feld: `secret` ist ein Feld mit `many` und
-- langer Eingabe, und seine Einträge tragen die Id, an der die
-- Wissensfreigabe hängt (`Secrets.secret#anker`). Das war der Anker.
--
-- Die Wanderung der Werte macht `prototype/migration/blocks-to-fields.mjs`
-- — dort steht auch, wie die Freigaben mitkommen. Hier steht nur, was
-- danach keine Spalte mehr braucht.

-- Zuerst die Freigaben: `Information.blocks` nannte Blockanker; die
-- Verweise stehen ab hier in `fields` und heissen `Typ.feld#anker`. Eine
-- Liste, die auf nichts mehr zeigt, stehen zu lassen sähe aus wie eine
-- Freigabe.
update component
set payload = payload - 'blocks'
where type = 'Information' and payload ? 'blocks';

update component
set payload = payload - 'blocks'
where type = '__meta' and payload ? 'blocks';

alter table interface_def drop column if exists block_types;

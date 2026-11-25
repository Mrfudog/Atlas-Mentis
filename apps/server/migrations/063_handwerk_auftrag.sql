-- Der Fertigungsauftrag (T-128): Art `CraftingOrder`, die Regeln des
-- Handwerks an der Kampagne, `instanceOf` für den Auftrag.
--
--  1. `CraftingOrder` — eine Instanz des Rezepts (erbt von `Recipe`) mit
--     Fortschritt, Ausgang und Proben.
--  2. `Campaign.craftFailure`, `craftCritSuccess`, `craftCritFailure`,
--     `craftConfirm` — die Regeln am Tisch; wandern mit T-132 in ein Modul.
--  3. `instanceOf` nimmt den Auftrag als Quelle dazu; `crafting` sagt, dass
--     es auf den Auftrag zeigt.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Zeilen
-- hier nach — **nur, wo schon ein Register steht** (wie 061). Ergänzt wird
-- nur, was fehlt; nichts wird entfernt, kein Artikel geändert.

insert into interface_def (name, label, abstract, extends, schema, area, views)
select 'CraftingOrder', 'Crafting order', false, array['Recipe'],
       '{"type":"object","properties":{"progress":{"type":"number","title":"Progress","min":0,"default":0,"readOnly":true},"outcome":{"type":"string","title":"Outcome","enum":["open","succeeded","failed","aborted"],"default":"open","readOnly":true},"started":{"type":"string","title":"Started","readOnly":true},"rolls":{"type":"array","title":"Rolls","items":{"type":"object"},"readOnly":true}}}'::json,
       'play',
       '{"full":[{"id":"co-craft","el":"crafting"},{"id":"co-f","el":"fields","fields":"all"},{"id":"co-b","el":"prose","fields":"all"},{"id":"co-r","el":"relations"}]}'::jsonb
where exists (select 1 from interface_def)
on conflict (name) do nothing;

update interface_def
   set schema = (
     schema::jsonb || jsonb_build_object('properties', (schema::jsonb -> 'properties') || '{
       "craftFailure":{"type":"string","title":"Crafting: on a failed check","enum":["recipe","noProgress","progressLost","materialsLost","halfLost","nothingLost","custom"],"default":"recipe"},
       "craftCritSuccess":{"type":"string","title":"Crafting: on a natural 20","enum":["asSuccess","double"],"default":"asSuccess"},
       "craftCritFailure":{"type":"string","title":"Crafting: on a natural 1","enum":["asFailure","progressLost","materialsLost"],"default":"asFailure"},
       "craftConfirm":{"type":"string","title":"Crafting: player checks count","enum":["gm","player"],"default":"gm"}
     }'::jsonb)
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'craftFailure';

update relation_def
   set from_ifaces = array_append(from_ifaces, 'CraftingOrder'),
       means = 'A statblock, item or crafting order is an instance of a template and stores only what differs; the template lists its instances.'
 where type = 'instanceOf'
   and not ('CraftingOrder' = any(from_ifaces));

update relation_def
   set means = 'A creature or party works on a crafting order (an instance of a recipe, with progress and rolls); the order lists who works on it.'
 where type = 'crafting';

-- `needs` und `yields` versprechen nichts mehr — der Auftrag liest sie
-- (Material reservieren und verbrauchen, Ertrag ins Inventar).
update relation_def set intended = null where type in ('needs', 'yields') and intended is not null;

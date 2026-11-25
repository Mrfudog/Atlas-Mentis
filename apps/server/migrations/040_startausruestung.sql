-- Startausrüstung nach Kampagnenregel (T-096, REQ-250).
--
-- Wie Spielende zu ihrer ersten Ausrüstung kommen, steht in Artikeln der
-- neuen Art `EquipmentMethod` (nach Regeln aus Klasse und Hintergrund,
-- Startgold fest oder gewürfelt, frei mit Budget und Grenzen). Die
-- Kampagne nennt die erlaubten über die Kante `allowsEquipment`; nennt sie
-- keines, gelten „Klasse und Hintergrund" und „Startgold". Dazu das Feld
-- `Class.startingGold` (`5d4×10`), das der Importer künftig füllt — ältere
-- Klassen lesen es beim Lesen aus dem Text von `startingEquipment`.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Zeilen
-- hier nach — **nur, wo schon ein Register steht** (wie 028, 033).
-- Entfernt wird nichts.

insert into interface_def (name, label, abstract, extends, schema, area, views)
select
  'EquipmentMethod', 'Starting equipment method', false, array['Rule'],
  '{"type":"object","required":["method"],"properties":{"method":{"type":"string","title":"Method","enum":["rules","gold","free"],"default":"rules"},"gold":{"type":"string","title":"Gold (gp, fixed or rolled)"},"budget":{"type":"number","min":0,"title":"Budget (gp)"},"magic":{"type":"object","title":"Magic items per rarity"},"itemTypes":{"type":"array","items":{"type":"string"},"enumRef":"Item.itemType","title":"Allowed item types"}}}'::json,
  'rules',
  '{"overview":[{"id":"eqm-ov","el":"fields","fields":["EquipmentMethod.method","EquipmentMethod.gold","EquipmentMethod.budget"]}]}'::jsonb
where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props)
select 'allowsEquipment', 'allows equipment method', 'allowed in', '{Campaign}', '{EquipmentMethod}', false, 'many', '{}'::jsonb
where exists (select 1 from relation_def)
on conflict (type) do nothing;

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,startingGold}',
     '{"type":"string","title":"Starting gold (gp)"}'::jsonb
   )::json
 where name = 'Class'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties' ? 'startingGold');

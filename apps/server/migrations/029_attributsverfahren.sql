-- Attributsverfahren als Daten und der Gruppenpool (T-080, REQ-238, E-016 a).
--
-- Wie Spielende zu ihren sechs Werten kommen, steht in Artikeln der neuen
-- Art `AbilityMethod` (feste Reihe, Punktekauf mit Kostentabelle, Würfeln
-- je Figur oder einmal für die Gruppe). Die Kampagne nennt die erlaubten
-- über die Kante `allowsMethod`; nennt sie keines, gelten Standardreihe und
-- Punktekauf. Ein Gruppenpool steht an der Gruppe (`abilityPool`).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Zeilen
-- hier nach — **nur, wo schon ein Register steht** (wie 028). Entfernt
-- wird nichts.

insert into interface_def (name, label, abstract, extends, schema, area, views)
select
  'AbilityMethod', 'Ability score method', false, array['Rule'],
  '{"type":"object","required":["method"],"properties":{"method":{"type":"string","title":"Method","enum":["array","pointBuy","roll"],"default":"array"},"scores":{"type":"array","items":{"type":"number"},"title":"Scores to assign"},"budget":{"type":"number","min":0,"title":"Point budget"},"costs":{"type":"object","title":"Cost per score"},"dice":{"type":"string","title":"Dice per score"},"count":{"type":"number","min":1,"max":12,"title":"Scores rolled","default":6},"scope":{"type":"string","title":"Rolled for","enum":["character","party"],"default":"character"}}}'::json,
  'rules',
  '{"overview":[{"id":"abm-ov","el":"fields","fields":["AbilityMethod.method","AbilityMethod.scope"]}]}'::jsonb
where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props)
select 'allowsMethod', 'allows ability method', 'allowed in', '{Campaign}', '{AbilityMethod}', false, 'many', '{}'::jsonb
where exists (select 1 from relation_def)
on conflict (type) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props)
select
  'abilityPool', 'rolled ability pool', 'pool of', '{Party}', '{AbilityMethod}', false, 'many',
  '{"type":"object","required":["values"],"properties":{"values":{"type":"array","items":{"type":"number"},"title":"Scores"},"rolls":{"type":"array","items":{"type":"string"},"title":"Rolls"},"at":{"type":"string","title":"Rolled at"}}}'::jsonb
where exists (select 1 from relation_def)
on conflict (type) do nothing;

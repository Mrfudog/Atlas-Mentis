-- Nicht verstaut, liegengelassen (T-140): auf bestehenden Datenbanken
-- nachziehen (wie 062).
--
--  1. `Campaign.stowing` — wie lange Unverstautes liegen darf: beliebig,
--     bis Sitzungsende, oder bis der Tisch weiterzieht. Ohne Angabe beliebig.
--  2. `holds.props.unstowed` — dieser Stapel liegt noch vor der Figur.
--  3. Die Kante `leftBehind` (Sitzung → Gegenstand, mit Menge, Herkunft
--     und Zeitpunkt) — was nicht rechtzeitig verstaut war.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Zeilen
-- hier nach — **nur, wo schon ein Register steht** (wie 061). Ergänzt wird
-- nur, was fehlt; nichts wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,stowing}',
     '{"type":"string","title":"Unstowed items","enum":["anytime","bySessionEnd","immediately"],"default":"anytime"}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'stowing';

update relation_def
   set props = jsonb_set(
     props,
     '{properties,unstowed}',
     '{"type":"boolean","title":"Not stowed yet"}'::jsonb
   )
 where type = 'holds'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties') ? 'unstowed';

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select v.* from (values
  ('leftBehind', 'left behind', 'left behind at', '{Session}'::text[], '{Item}'::text[], false, 'many',
   '{"type":"object","properties":{"qty":{"type":"number","min":1,"title":"Quantity"},"from":{"type":"string","format":"link","target":{"interfaces":["Inventory"]},"title":"Left by"},"at":{"type":"string","title":"When"}}}'::jsonb,
   'A session keeps what was not stowed in time, with quantity and the inventory it came from; the item lists where it was left behind.')
) as v(type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
where exists (select 1 from relation_def)
on conflict (type) do nothing;

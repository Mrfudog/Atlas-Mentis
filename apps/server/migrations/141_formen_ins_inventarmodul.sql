-- Die Formen aus den Ergänzungen ziehen ins Inventarmodul (T-394, E-165).
--
-- T-142 legte je Gegenstand eine Ergänzung an (eine Fassung mit
-- `overrides.props.fields` = Item.rows/Item.stackSize) in einer eigenen
-- Ebene („Item shapes (Basil Homebrew)“ auf dev, 81 Stück). Nach E-165
-- wohnen diese Werte als Daten des Inventarmoduls, nicht als Artikel:
--
-- 1. **Die Ebene wird eine Regelmechanik:** eine Ebene, die nur solche
--    Ergänzungen bringt, bekommt die Art `RuleMechanic` (`method: shapes`)
--    und die Karte `ShapeDefaults`; ihre Kanten (Gruppe, Aufschaltungen,
--    Rechte) bleiben, also gilt sie in genau den Kampagnen weiter, in
--    denen sie galt. Gibt es das Regelsystem Inventory schon, wird sie
--    seine Mechanik (`partOf`) und gilt mit Grid (`compatibleWith`).
-- 2. **Je Ergänzung ein Wert je Gegenstand** (`shapeItems`, Schlüssel ist
--    das Original, auf das die Ergänzung zeigt): ihre Form und ihr Stapel.
--    Ein Wert, den die Ebene für denselben Gegenstand schon trägt, bleibt.
-- 3. **Die Ergänzungen gehen weg** — ihre Werte stehen jetzt in der Karte.
--
-- Was dabei verloren ginge, zählt die Prüfabfrage: Inhalt einer Ergänzung
-- ausser Name, Nummer, Status und den beiden Feldern, und Kanten anderer
-- Artikel auf eine Ergänzung. Steht dort etwas, bricht der Start ohne
-- Freigabe ab (T-076).
-- Nummer beim Hereinmergen nachgesehen: 141.
--
-- verlust: select count(*) from (select e.id from entity e join relation o on o.from_id = e.id and o.type = 'overrides' and jsonb_typeof(o.props->'fields') = 'array' and jsonb_array_length(o.props->'fields') > 0 and not exists (select 1 from jsonb_array_elements_text(o.props->'fields') f where f not in ('Item.rows', 'Item.stackSize')) where exists (select 1 from component c where c.entity_id = e.id and c.type not in ('__meta', 'Identity', 'Status', 'Item')) or exists (select 1 from component c where c.entity_id = e.id and c.type = 'Item' and exists (select 1 from jsonb_object_keys(c.payload) k where k not in ('rows', 'stackSize'))) or exists (select 1 from relation x where x.to_id = e.id) union select x.id from relation x join relation o on o.from_id = x.to_id and o.type = 'overrides' and jsonb_typeof(o.props->'fields') = 'array' and not exists (select 1 from jsonb_array_elements_text(o.props->'fields') f where f not in ('Item.rows', 'Item.stackSize'))) v

-- Die Ergänzungen, die nur Form und Stapel tragen, mit ihrem Original und ihrer Ebene.
create temp table t141_erg on commit drop as
select e.id,
       o.to_id as item,
       l.to_id as layer,
       c.payload -> 'rows' as rows,
       c.payload -> 'stackSize' as stack
  from entity e
  join relation o on o.from_id = e.id and o.type = 'overrides'
                 and jsonb_typeof(o.props->'fields') = 'array' and jsonb_array_length(o.props->'fields') > 0
                 and not exists (select 1 from jsonb_array_elements_text(o.props->'fields') f where f not in ('Item.rows', 'Item.stackSize'))
  join relation l on l.from_id = e.id and l.type = 'inLayer'
  left join component c on c.entity_id = e.id and c.type = 'Item'
 where exists (select 1 from entity t where t.id = o.to_id);

-- Die Ebenen, die nur solche Ergänzungen bringen (sonst wird nichts umgebaut).
create temp table t141_ebene on commit drop as
select distinct t.layer
  from t141_erg t
  join component m on m.entity_id = t.layer and m.type = '__meta' and m.payload->'interfaces'->>0 = 'Layer'
 where exists (select 1 from interface_def where name = 'RuleMechanic')
   and not exists (
     select 1 from relation x
      where x.type = 'inLayer' and x.to_id = t.layer
        and x.from_id not in (select id from t141_erg));

delete from t141_erg where layer not in (select layer from t141_ebene);

do $$
declare n int;
begin
  select count(*) into n from t141_erg;
  raise notice 'Formen aus % Ergänzungen in % Ebene(n) ins Inventarmodul', n, (select count(*) from t141_ebene);
end $$;

update component m
   set payload = jsonb_set(m.payload, '{interfaces}', '["RuleMechanic"]'::jsonb)
 where m.type = '__meta' and m.entity_id in (select layer from t141_ebene);

insert into component(entity_id, type, payload)
select layer, 'RuleMechanic', '{"method":"shapes"}'::jsonb from t141_ebene
on conflict (entity_id, type) do nothing;

insert into component(entity_id, type, payload)
select layer, 'ShapeDefaults', '{"shapeGroups":[],"shapeItems":[]}'::jsonb from t141_ebene
on conflict (entity_id, type) do nothing;

-- Je Gegenstand ein Eintrag; einer, den die Karte schon nennt, bleibt.
update component k
   set payload = jsonb_set(k.payload, '{shapeItems}',
         coalesce(k.payload->'shapeItems', '[]'::jsonb) || coalesce((
           select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', t.item, 'rows', t.rows, 'stackSize', t.stack)) order by t.item)
             from (select distinct on (item) * from t141_erg where layer = k.entity_id order by item, id) t
            where not exists (select 1 from jsonb_array_elements(coalesce(k.payload->'shapeItems', '[]'::jsonb)) a where a->>'id' = t.item)
         ), '[]'::jsonb))
 where k.type = 'ShapeDefaults' and k.entity_id in (select layer from t141_ebene);

insert into relation(id, from_id, to_id, type, props, ord)
select v.layer || '~' || v.type || '-' || v.to_id, v.layer, v.to_id, v.type, '{}'::jsonb, 1
  from (select layer, 'ly_rs_inventory' as to_id, 'partOf' as type from t141_ebene
        union all
        select layer, 'ly_rm_grid', 'compatibleWith' from t141_ebene) v
 where exists (select 1 from entity e where e.id = v.to_id)
on conflict (id) do nothing;

-- Was neben den Ergänzungen steht (wer sie anlegte, ihr fertiger Stand), geht mit.
delete from app_user_article where entity_id in (select id from t141_erg);
delete from entity_creator where entity_id in (select id from t141_erg);
delete from entity_ready where entity_id in (select id from t141_erg);

delete from entity where id in (select id from t141_erg);

update entity set updated_at = now() where id in (select layer from t141_ebene);

-- Gegenstandsmerkmale (T-324, E-163; E-110 a).
--
-- Was an einen Gegenstand kommt, ohne selbst einer zu sein, ist ein
-- Regelartikel: die Art `ItemFeature` (abstrakt, unter Rule) mit zwei
-- Sorten — `ItemProperty` (Finesse, Versatile; bisher direkt unter Rule)
-- und `Enhancement` (+1 Weapon, Silvered; bisher ein Gegenstand mit
-- `appliesTo`). Am Merkmal: woran es passt, Namensteile, Aufpreis und was
-- es am Bogen bewirkt (`mechanics`); am Enhancement Seltenheit und Boni.
-- Die Werte des Einzelfalls (Versatile 1d10, Thrown 20/60) stehen an der
-- Kante `hasProperty`; `enchantedWith` zeigt auf `Enhancement`.
--
-- 1. Register: dieselben Zeilen wie in `packages/registry`, nur wo schon
--    eines steht. Am Gegenstand fallen `appliesTo`, `namePrefix`,
--    `nameSuffix`, `priceAdd` und `priceMult` weg — sie stehen jetzt am
--    Merkmal.
-- 2. Bestand: **jeder Gegenstand (Art genau `Item`) mit `appliesTo` wird
--    ein Enhancement** — die eingelesenen Varianten samt ihren
--    Überschreibungen und Instanzen. Id, Nummer, Name, Text, Kanten
--    bleiben; die Karte `Item` wird aufgeteilt: woran/Namensteile/Aufpreis
--    nach `ItemFeature`, Seltenheit/Einstimmung/Boni nach `Enhancement`,
--    der Preis ist ohne eigene Angabe der Aufpreis (so rechnete T-300).
--    **Was ein Merkmal nicht trägt, geht nicht verloren:** es steht als
--    Satz in `Notes.note`, Eintrag `item-fields` („As an item: tier:
--    major; charges: 3") — wie 025 und 048.
-- 3. Eigenschaften bekommen ihre Wirkung als Daten (`mechanics`), aus der
--    Abkürzung von 5e.tools (2H, V, L, F) oder, ohne sie, aus dem Namen —
--    einmal hier, damit der Bogen danach nur noch die Daten fragt.
--
-- Auf einer frischen Datenbank ist nichts zu tun: dort schreibt der Seed
-- das Register, und es gibt noch keine Artikel.
--
-- Weg fiele nur, was eine Variante schon in einer Karte `ItemFeature` oder
-- `Enhancement` trüge — an einem Gegenstand verweigert die Prüfung das
-- (`card_not_inherited`), also erwartet: 0.
-- verlust: select count(*) from component c join component m on m.entity_id = c.entity_id and m.type = '__meta' and m.payload->'interfaces'->>0 = 'Item' join component i on i.entity_id = c.entity_id and i.type = 'Item' and jsonb_typeof(i.payload->'appliesTo') = 'array' and jsonb_array_length(i.payload->'appliesTo') > 0 where c.type in ('ItemFeature', 'Enhancement')

insert into interface_def (name, label, abstract, extends, schema, area, views)
select 'ItemFeature', 'Item feature', true, array['Rule', 'Effects', 'Image', 'Lore', 'Secrets', 'Facts']::text[], '{"type":"object","properties":{"appliesTo":{"type":"array","title":"Applies to","items":{"type":"string"},"description":"Words (weapon, armor, sword) or pairs (weaponCategory:martial) an item must match; one is enough. Empty: any item."},"namePrefix":{"type":"string","title":"Name prefix","description":"Put in front of the base item''s name on a piece with this feature, such as \"+1 \" or \"Silvered \"."},"nameSuffix":{"type":"string","title":"Name suffix","description":"Put after the base item''s name on a piece with this feature, such as \" of Warning\"."},"priceAdd":{"type":"number","min":0,"title":"Surcharge in copper","description":"What this feature adds to the base item''s price, in copper."},"priceMult":{"type":"number","min":0,"title":"Price factor","description":"Multiplies the base item''s price, before surcharges are added (2 doubles it)."},"mechanics":{"type":"array","title":"On the sheet","items":{"type":"string"},"enum":["two-handed","versatile","light","finesse"],"description":"What the sheet does with it: two-handed takes both hands, versatile uses the two-handed damage when gripped in both, light allows a second weapon in the off hand, finesse lets Dexterity attack (and Sneak Attack)."}}}'::jsonb, 'rules', null
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into interface_def (name, label, abstract, extends, schema, area, views)
select 'Enhancement', 'Enhancement', false, array['ItemFeature']::text[], '{"type":"object","properties":{"rarity":{"type":"string","title":"Rarity","enumRef":"Item.rarity"},"attunement":{"type":"boolean","title":"Requires attunement","glossary":"Attunement"},"attunementNote":{"type":"string","title":"Attunement by"},"bonusWeapon":{"type":"number","title":"Attack and damage bonus","format":"signed"},"bonusAc":{"type":"number","title":"AC bonus","format":"signed"},"bonusSpellAttack":{"type":"number","title":"Spell attack bonus","format":"signed"},"bonusSave":{"type":"number","title":"Saving throw bonus","format":"signed"}}}'::jsonb, 'rules', '{"overview":[{"id":"enh-ov","el":"fields","fields":["Enhancement.rarity","ItemFeature.appliesTo"]}]}'::jsonb
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

update interface_def
   set extends = array['ItemFeature']::text[]
 where name = 'ItemProperty'
   and extends = array['Rule']::text[];

update interface_def
   set schema = (schema::jsonb #- '{properties,appliesTo}' #- '{properties,namePrefix}' #- '{properties,nameSuffix}'
                              #- '{properties,priceAdd}' #- '{properties,priceMult}')::json
 where name = 'Item'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object';

update relation_def
   set props = '{"type":"object","properties":{"damage":{"type":"string","title":"Damage","description":"The damage this property gives here, such as 1d10 for versatile."},"range":{"type":"string","format":"measure","unit":"ft","title":"Range","description":"The range this property gives here, such as 20/60 for thrown."},"note":{"type":"string","title":"Only here"}}}'::jsonb
 where type = 'hasProperty'
   and not coalesce((props -> 'properties') ? 'damage', false);

update relation_def
   set to_ifaces = '{Enhancement}'::text[]
 where type = 'enchantedWith';

-- 2. Die Varianten: Art genau `Item`, `appliesTo` nicht leer — und was sie
--    überschreibt oder eine Instanz von ihnen ist (sonst stünde eine
--    Überschreibung auf einer anderen Art als ihr Original).
create temp table _merkmal on commit drop as
with recursive betroffen(id) as (
  select c.entity_id
    from component c
    join component m on m.entity_id = c.entity_id and m.type = '__meta'
   where c.type = 'Item'
     and m.payload -> 'interfaces' ->> 0 = 'Item'
     and jsonb_typeof(c.payload -> 'appliesTo') = 'array'
     and jsonb_array_length(c.payload -> 'appliesTo') > 0
  union
  select x.from_id
    from relation x
    join betroffen b on b.id = x.to_id
    join component m on m.entity_id = x.from_id and m.type = '__meta'
   where x.type in ('overrides', 'instanceOf')
     and m.payload -> 'interfaces' ->> 0 = 'Item'
)
select distinct id from betroffen;

do $$
declare
  r      record;
  k      text;
  v      jsonb;
  feat   jsonb;
  enh    jsonb;
  rest   text[];
  satz   text;
  n      int := 0;
  notiz  int := 0;
begin
  for r in
    select m.id, coalesce(c.payload, '{}'::jsonb) as it
      from _merkmal m
      left join component c on c.entity_id = m.id and c.type = 'Item'
  loop
    feat := '{}'::jsonb;
    enh := '{}'::jsonb;
    rest := array[]::text[];
    for k, v in select * from jsonb_each(r.it) loop
      if k in ('appliesTo', 'namePrefix', 'nameSuffix', 'priceAdd', 'priceMult', 'mechanics') then
        feat := feat || jsonb_build_object(k, v);
      elsif k in ('rarity', 'attunement', 'attunementNote', 'bonusWeapon', 'bonusAc', 'bonusSpellAttack', 'bonusSave') then
        enh := enh || jsonb_build_object(k, v);
      end if;
    end loop;
    for k, v in select * from jsonb_each(r.it) loop
      continue when k in ('appliesTo', 'namePrefix', 'nameSuffix', 'priceAdd', 'priceMult', 'mechanics',
                          'rarity', 'attunement', 'attunementNote', 'bonusWeapon', 'bonusAc', 'bonusSpellAttack', 'bonusSave');
      if k = 'copperPrice' and not (feat ? 'priceAdd' or feat ? 'priceMult') then
        feat := feat || jsonb_build_object('priceAdd', v);
        continue;
      end if;
      continue when v = 'null'::jsonb or v = '""'::jsonb;
      rest := rest || (k || ': ' || case jsonb_typeof(v)
        when 'string' then v #>> '{}'
        when 'array' then (select string_agg(coalesce(e #>> '{}', ''), ', ') from jsonb_array_elements(v) e)
        else v::text end);
    end loop;

    delete from component where entity_id = r.id and type in ('Item', 'ItemFeature', 'Enhancement');
    if feat <> '{}'::jsonb then
      insert into component (entity_id, type, payload) values (r.id, 'ItemFeature', feat);
    end if;
    if enh <> '{}'::jsonb then
      insert into component (entity_id, type, payload) values (r.id, 'Enhancement', enh);
    end if;
    if array_length(rest, 1) > 0 then
      satz := 'As an item: ' || array_to_string(rest, '; ');
      update component
         set payload = jsonb_set(payload, '{note}',
               coalesce(payload -> 'note', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', 'item-fields', 'value', satz)))
       where entity_id = r.id and type = 'Notes';
      if not found then
        insert into component (entity_id, type, payload)
        values (r.id, 'Notes', jsonb_build_object('note', jsonb_build_array(jsonb_build_object('id', 'item-fields', 'value', satz))));
      end if;
      notiz := notiz + 1;
    end if;
    update component
       set payload = jsonb_set(payload, '{interfaces,0}', '"Enhancement"'::jsonb)
     where entity_id = r.id and type = '__meta';
    update entity set updated_at = now(), revision = revision + 1 where id = r.id;
    n := n + 1;
  end loop;
  raise notice '162: % Varianten zu Enhancements, % davon mit Feldern in den Notizen', n, notiz;
end $$;

-- 3. Die Wirkung der Eigenschaften als Daten.
create temp table _wirkung on commit drop as
select m.entity_id as id,
       case coalesce(nullif(split_part(p.payload ->> 'abbreviation', '|', 1), ''), '')
         when '2H' then 'two-handed' when 'V' then 'versatile' when 'L' then 'light' when 'F' then 'finesse'
         else case lower(btrim(i.payload ->> 'name'))
           when 'two-handed' then 'two-handed' when 'versatile' then 'versatile' when 'light' then 'light' when 'finesse' then 'finesse'
         end
       end as wirkung
  from component m
  left join component p on p.entity_id = m.entity_id and p.type = 'ItemProperty'
  left join component i on i.entity_id = m.entity_id and i.type = 'Identity'
 where m.type = '__meta'
   and m.payload -> 'interfaces' ->> 0 = 'ItemProperty';

delete from _wirkung where wirkung is null
   or exists (select 1 from component f where f.entity_id = _wirkung.id and f.type = 'ItemFeature' and f.payload ? 'mechanics');

update component f
   set payload = f.payload || jsonb_build_object('mechanics', jsonb_build_array(w.wirkung))
  from _wirkung w
 where f.entity_id = w.id and f.type = 'ItemFeature';

insert into component (entity_id, type, payload)
select w.id, 'ItemFeature', jsonb_build_object('mechanics', jsonb_build_array(w.wirkung))
  from _wirkung w
 where not exists (select 1 from component f where f.entity_id = w.id and f.type = 'ItemFeature');

update entity set updated_at = now(), revision = revision + 1 where id in (select id from _wirkung);

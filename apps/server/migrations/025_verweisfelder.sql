-- Zwei Felder, die Artikel meinten, werden Verweise (T-078).
--
-- `Statblock.conditionImmunities` hielt die Namen der `Condition`-Artikel
-- (D50: „ein Name ist der heutige Stand"), `Weapon.ammoType` das Wort für
-- die Munition („arrow"), das genau einen Gegenstand meinte. Ein Name zeigt
-- nur, solange niemand umbenennt, und man kommt von ihm nicht zum Artikel.
-- Jetzt halten beide die Id, wie `Vitals.conditions` und `Action.actionType`.
--
-- Zugeordnet wird über den Namen, ohne Gross- und Kleinschreibung, und nur,
-- wenn **genau ein** Artikel der Zielart so heisst — Instanzen und
-- Überschreibungen zählen nicht mit (sie sind kein Verweisziel). Steht
-- schon eine Id da, bleibt sie. **Was sich nicht zuordnen lässt, geht nicht
-- verloren**: es wandert als Satz in `Notes.note` desselben Artikels
-- („Condition immunities: Disease"), Eintrag `condition-immunities` bzw.
-- `ammunition`. Bei 5e.tools trifft das vier Statblocks mit „Disease".
--
-- Auf einer frischen Datenbank ist nichts zu tun.

create temp table _verweis_ziel (art text, name text, id text) on commit drop;

-- Zielarten samt Untertypen, die `extends`-Kette hinunter.
insert into _verweis_ziel (art, name, id)
with recursive kette(wurzel, name) as (
  select w, w from unnest(array['Condition', 'Item']) as w
  union
  select k.wurzel, d.name from interface_def d join kette k on k.name = any(d.extends)
)
select k.wurzel, lower(btrim(i.payload->>'name')), i.entity_id
from component i
join component m on m.entity_id = i.entity_id and m.type = '__meta'
join kette k on k.name = m.payload->'interfaces'->>0
where i.type = 'Identity'
  and coalesce(btrim(i.payload->>'name'), '') <> ''
  and not exists (
    select 1 from relation x
    where x.from_id = i.entity_id and x.type in ('instanceOf', 'overrides')
  );

-- Je Name nur, was eindeutig ist.
create temp table _verweis_eindeutig on commit drop as
select art, name, min(id) as id from _verweis_ziel group by art, name having count(*) = 1;

create or replace function pg_temp.verweis_notiz(eid text, nid text, satz text) returns void
language plpgsql as $$
begin
  update component
     set payload = jsonb_set(
       payload, '{note}',
       coalesce(payload->'note', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', nid, 'value', satz)))
   where entity_id = eid and type = 'Notes';
  if not found then
    insert into component (entity_id, type, payload)
    values (eid, 'Notes', jsonb_build_object('note', jsonb_build_array(jsonb_build_object('id', nid, 'value', satz))));
  end if;
end $$;

do $$
declare
  r      record;
  wert   text;
  ziel   text;
  ids    jsonb;
  rest   text[];
begin
  -- Statblock.conditionImmunities: eine Liste von Namen → eine Liste von Ids.
  for r in
    select entity_id, payload from component
    where type = 'Statblock' and jsonb_typeof(payload->'conditionImmunities') = 'array'
  loop
    ids := '[]'::jsonb;
    rest := '{}';
    for wert in select jsonb_array_elements_text(r.payload->'conditionImmunities') loop
      if exists (select 1 from entity where id = wert) then
        ziel := wert;
      else
        select id into ziel from _verweis_eindeutig where art = 'Condition' and name = lower(btrim(wert));
      end if;
      if ziel is null then
        rest := rest || wert;
      elsif not ids ? ziel then
        ids := ids || to_jsonb(ziel);
      end if;
      ziel := null;
    end loop;
    -- Eine leere Liste fiele an einer Instanz über die der Vorlage; was
    -- nicht zugeordnet ist, steht ja in der Notiz.
    update component
       set payload = case when jsonb_array_length(ids) > 0
                          then jsonb_set(payload, '{conditionImmunities}', ids)
                          else payload #- '{conditionImmunities}' end
     where entity_id = r.entity_id and type = 'Statblock';
    if array_length(rest, 1) > 0 then
      perform pg_temp.verweis_notiz(r.entity_id, 'condition-immunities',
        'Condition immunities: ' || array_to_string(rest, ', '));
    end if;
  end loop;

  -- Weapon.ammoType: ein Wort → die Id des Munitionsartikels.
  for r in
    select entity_id, payload->>'ammoType' as wort from component
    where type = 'Weapon' and coalesce(btrim(payload->>'ammoType'), '') <> ''
  loop
    if exists (select 1 from entity where id = r.wort) then
      continue;
    end if;
    select id into ziel from _verweis_eindeutig where art = 'Item' and name = lower(btrim(r.wort));
    if ziel is not null then
      update component set payload = jsonb_set(payload, '{ammoType}', to_jsonb(ziel))
       where entity_id = r.entity_id and type = 'Weapon';
    else
      -- Das Wort steht danach in der Notiz; das Feld nimmt nur Ids.
      update component set payload = payload #- '{ammoType}'
       where entity_id = r.entity_id and type = 'Weapon';
      perform pg_temp.verweis_notiz(r.entity_id, 'ammunition', 'Ammunition: ' || r.wort);
    end if;
    ziel := null;
  end loop;
end $$;

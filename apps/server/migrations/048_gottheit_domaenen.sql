-- Die Domänen einer Gottheit werden Verweise auf Unterklassen (E-020, T-099).
--
-- `Deity.domains` hielt Wörter („Knowledge", „War"). Sie meinen die
-- Unterklasse des Klerikers, die eine Anhängerin dieser Gottheit wählt —
-- „Knowledge Domain" mit ihren Zaubern —, nur ohne dass man hinkam. Auf dev
-- treffen 777 von 778 Werten genau eine Unterklasse; die Fassungen aus
-- Plane Shift heissen „Knowledge Domain (PSA)" und kommen sich nicht in
-- die Quere. Der eine Rest ist „Unknown".
--
-- Zugeordnet wird ohne Gross- und Kleinschreibung, in drei Stufen: der
-- Name selbst („Knowledge Domain"), dann der Name mit „ Domain" dahinter,
-- dann der Kurzname (`Subclass.shortName`). Es gilt die erste Stufe, die
-- etwas trifft, und nur, wenn sie **genau eine** Unterklasse trifft — „War"
-- ist auch der Kurzname von „War Magic" (Magier), „War Domain" aber nur
-- eine. Instanzen und Überschreibungen zählen nicht mit (sie sind kein
-- Verweisziel). Steht schon eine Id da, bleibt sie. **Was sich nicht
-- zuordnen lässt, geht nicht verloren**: es wandert als Satz in
-- `Notes.note` desselben Artikels („Domains: Unknown"), Eintrag `domains`
-- — wie 025.
--
-- Auf einer frischen Datenbank ist nichts zu tun.

create temp table _domaene_ziel (stufe int, schluessel text, id text) on commit drop;

-- Unterklassen samt Untertypen, die `extends`-Kette hinunter.
insert into _domaene_ziel (stufe, schluessel, id)
with recursive kette(name) as (
  select 'Subclass'::text
  union
  select d.name from interface_def d join kette k on k.name = any(d.extends)
),
ziel as (
  select i.entity_id as id, btrim(i.payload->>'name') as name, btrim(s.payload->>'shortName') as kurz
  from component i
  join component m on m.entity_id = i.entity_id and m.type = '__meta'
  join kette k on k.name = m.payload->'interfaces'->>0
  left join component s on s.entity_id = i.entity_id and s.type = 'Subclass'
  where i.type = 'Identity'
    and coalesce(btrim(i.payload->>'name'), '') <> ''
    and not exists (
      select 1 from relation x
      where x.from_id = i.entity_id and x.type in ('instanceOf', 'overrides')
    )
)
select distinct v.stufe, lower(v.w), ziel.id
from ziel, lateral (values
  (1, name),
  (2, case when name ~* '\s+Domain$' then regexp_replace(name, '\s+Domain$', '', 'i') end),
  (3, kurz)
) as v(stufe, w)
where coalesce(v.w, '') <> '';

-- Je Wort die erste Stufe, die trifft — und nur, wenn sie eindeutig trifft.
create temp table _domaene_eindeutig on commit drop as
select schluessel, min(id) as id
from _domaene_ziel z
where stufe = (select min(stufe) from _domaene_ziel y where y.schluessel = z.schluessel)
group by schluessel
having count(distinct id) = 1;

create or replace function pg_temp.domaene_notiz(eid text, satz text) returns void
language plpgsql as $$
begin
  update component
     set payload = jsonb_set(
       payload, '{note}',
       coalesce(payload->'note', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', 'domains', 'value', satz)))
   where entity_id = eid and type = 'Notes';
  if not found then
    insert into component (entity_id, type, payload)
    values (eid, 'Notes', jsonb_build_object('note', jsonb_build_array(jsonb_build_object('id', 'domains', 'value', satz))));
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
  for r in
    select entity_id, payload from component
    where type = 'Deity' and jsonb_typeof(payload->'domains') = 'array'
  loop
    ids := '[]'::jsonb;
    rest := '{}';
    for wert in select jsonb_array_elements_text(r.payload->'domains') loop
      if exists (select 1 from entity where id = wert) then
        ziel := wert;
      else
        select id into ziel from _domaene_eindeutig where schluessel = lower(btrim(wert));
      end if;
      if ziel is null then
        rest := rest || wert;
      elsif not ids ? ziel then
        ids := ids || to_jsonb(ziel);
      end if;
      ziel := null;
    end loop;
    update component
       set payload = case when jsonb_array_length(ids) > 0
                          then jsonb_set(payload, '{domains}', ids)
                          else payload #- '{domains}' end
     where entity_id = r.entity_id and type = 'Deity';
    if array_length(rest, 1) > 0 then
      perform pg_temp.domaene_notiz(r.entity_id, 'Domains: ' || array_to_string(rest, ', '));
    end if;
  end loop;
end $$;

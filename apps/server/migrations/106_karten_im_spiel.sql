-- Karten und Begegnungen im Spiel als Instanz (T-289, E-039, E-041).
--
-- 1. Register: der Obertyp `Played` (wann, in welcher Sitzung), Karte und
--    Begegnung nehmen ihn dazu; `Map.released` (für Spielende erst nach
--    der Freigabe da); `instanceOf` gilt auch für Karte und Begegnung.
-- 2. Bestand: je Karte, die heute Spiel-Tokens (`marker` mit `kind: play`)
--    trägt oder als „Map on the table" an einer Sitzung liegt, **eine
--    Instanz** `mi_<karte>` — freigegeben (Spielende sahen die Karte bis
--    jetzt), in den Ebenen der Karte, mit dem Nebel der Karte. Die
--    Spiel-Tokens und das Aufgedeckte (`Map.reveal`) **wandern** an die
--    Instanz, die Sitzungen zeigen auf sie. Vorbereitetes, Vorplatziertes
--    (`props.encounter`) und die Gruppe bleiben an der Karte.
--
-- Verloren geht nichts: was an der Karte wegfällt (die Spiel-Tokens, das
-- Aufgedeckte), steht im selben Schritt an der Instanz. Die Prüfabfrage
-- zählt, was ohne Ziel bliebe — Spiel-Tokens an einer Karte, deren Id für
-- die Instanz schon vergeben ist; die überspringt der Schritt und lässt sie,
-- wo sie sind. Jede angelegte Instanz wird aufgezählt (NOTICE).
-- verlust: select count(*) from relation r where r.type = 'marker' and r.props->>'kind' = 'play' and not (r.props ? 'encounter') and exists (select 1 from entity e where e.id = 'mi_' || r.from_id) and not exists (select 1 from relation i where i.from_id = 'mi_' || r.from_id and i.type = 'instanceOf' and i.to_id = r.from_id)

insert into interface_def (name, label, abstract, extends, schema)
select 'Played', 'Played', true, array[]::text[],
       '{"type":"object","properties":{"playedAt":{"type":"string","title":"Played on","readOnly":true,"description":"When this map or encounter was taken into play — set on the instance, empty on the template."},"playedIn":{"type":"string","format":"link","title":"Played in","readOnly":true,"description":"The session that took this instance into play.","target":{"interfaces":["Session"]}}}}'::json
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

update interface_def
   set extends = extends || array['Played']
 where name in ('Map', 'Encounter') and not ('Played' = any(extends))
   and exists (select 1 from interface_def where name = 'Played');

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,released}',
         '{"type":"boolean","title":"Released to players","description":"On a map in play: players see it only once released, with the fog already on. A template map is not affected."}'::jsonb
       )::json
 where name = 'Map'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'released');

update relation_def
   set from_ifaces = from_ifaces || array['Map'],
       means = 'A statblock, item, crafting order, map or encounter is an instance of a template and stores only what differs; the template lists its instances.'
 where type = 'instanceOf' and not ('Map' = any(from_ifaces));

update relation_def
   set from_ifaces = from_ifaces || array['Encounter']
 where type = 'instanceOf' and not ('Encounter' = any(from_ifaces));

-- Der Bestand.
do $$
declare
  k record;
  inst text;
  nummer int := coalesce((select max(substring(x.payload->>'id' from '^map-(\d+)$')::int)
                            from component x where x.type = 'Identity'), 0);
  sitzung text;
  bewegt int;
begin
  if not exists (select 1 from interface_def where name = 'Played') then
    return;
  end if;
  for k in
    select m.entity_id as id,
           coalesce(nullif(btrim(i.payload->>'name'), ''), m.entity_id) as name,
           coalesce(c.payload, '{}'::jsonb) as karte
      from component m
      left join component i on i.entity_id = m.entity_id and i.type = 'Identity'
      left join component c on c.entity_id = m.entity_id and c.type = 'Map'
     where m.type = '__meta'
       and m.payload->'interfaces'->>0 = 'Map'
       and not exists (select 1 from relation r where r.from_id = m.entity_id and r.type = 'instanceOf')
       and not exists (select 1 from entity e where e.id = 'mi_' || m.entity_id)
       and (exists (select 1 from relation r
                     where r.from_id = m.entity_id and r.type = 'marker'
                       and r.props->>'kind' = 'play' and not (r.props ? 'encounter'))
            or exists (select 1 from component s
                        where s.type in ('Session', 'SessionState')
                          and s.payload->>'activeMap' = m.entity_id))
     order by 2, 1
  loop
    inst := 'mi_' || k.id;
    nummer := nummer + 1;
    select s.entity_id into sitzung
      from component s
     where s.type in ('Session', 'SessionState') and s.payload->>'activeMap' = k.id
     order by s.entity_id
     limit 1;

    insert into entity(id) values (inst);
    insert into component(entity_id, type, payload) values
      (inst, '__meta', jsonb_build_object('interfaces', jsonb_build_array('Map'), 'adhoc', '[]'::jsonb)),
      (inst, 'Identity', jsonb_build_object('name', k.name, 'id', 'map-' || lpad(nummer::text, 4, '0'), 'aliases', '[]'::jsonb)),
      (inst, 'Status', jsonb_build_object('status', 'ready')),
      (inst, 'Played', jsonb_build_object('playedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                       || case when sitzung is null then '{}'::jsonb else jsonb_build_object('playedIn', sitzung) end),
      (inst, 'Map', jsonb_build_object('fog', coalesce(k.karte->'fog', 'false'::jsonb),
                                       'reveal', coalesce(k.karte->'reveal', '[]'::jsonb),
                                       'released', true));
    insert into component(entity_id, type, payload)
    select inst, 'Visibility', v.payload from component v where v.entity_id = k.id and v.type = 'Visibility';

    insert into relation(id, from_id, to_id, type, props, ord)
    values (inst || '~instanceOf', inst, k.id, 'instanceOf', '{}'::jsonb, 1);
    insert into relation(id, from_id, to_id, type, props, ord)
    select r.id || '@' || inst, inst, r.to_id, 'inLayer', r.props, 1 + row_number() over (order by r.ord, r.id)
      from relation r where r.from_id = k.id and r.type = 'inLayer';

    -- Die Marker der Karte liest die Instanz nur, solange sie keine eigenen
    -- hat (Kanten je Art); also stehen alle an ihr: die Spiel-Tokens
    -- wandern, die übrigen als Kopie.
    insert into relation(id, from_id, to_id, type, props, ord)
    select r.id || '@' || inst, inst, r.to_id, 'marker', r.props, 100 + row_number() over (order by r.ord, r.id)
      from relation r
     where r.from_id = k.id and r.type = 'marker'
       and exists (select 1 from relation p
                    where p.from_id = k.id and p.type = 'marker'
                      and p.props->>'kind' = 'play' and not (p.props ? 'encounter'));
    delete from relation r
     where r.from_id = k.id and r.type = 'marker'
       and r.props->>'kind' = 'play' and not (r.props ? 'encounter');
    get diagnostics bewegt = row_count;

    update component set payload = payload - 'reveal' where entity_id = k.id and type = 'Map';
    update component set payload = jsonb_set(payload, '{activeMap}', to_jsonb(inst))
     where type in ('Session', 'SessionState') and payload->>'activeMap' = k.id;

    raise notice 'T-289: % (%) → Instanz % — % Spiel-Token(s) umgezogen, Sitzung %', k.name, k.id, inst, bewegt, coalesce(sitzung, '—');
  end loop;
end $$;

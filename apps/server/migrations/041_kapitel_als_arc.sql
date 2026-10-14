-- Kapitel als Arc, Karten als eigene Szenen (T-097, REQ-252, E-026).
--
-- Ein Kapitel eines Abenteuers war eine `Story` mit `kind: 'chapter'`, ein
-- Arc der eigenen Kampagne eine mit `kind: 'arc'`. Seit E-026 ist der Arc
-- eine eigene Art (erbt von `Story`, trägt Stufen, Hook, Ausgang), und ein
-- Kapitel ist ein Arc — damit es sich als Ganzes in die eigene Kampagne
-- holen lässt (`take`) und dort steht, wo ein eigener Arc stünde.
--
-- Hier kommt nach:
--  1. die Registerzeile `Arc` — **nur, wo schon ein Register steht** (wie
--     028, 038); eine frische Datenbank bekommt sie vom Seed;
--  2. jede Story mit `kind` `chapter` oder `arc` wird ein `Arc`. Die Karte
--     `Story` bleibt (Recap, „Played on" …). Das Wort fällt weg, wo die Art
--     es jetzt sagt: `arc` überall, `chapter` an importierten Kapiteln (die
--     erkennt man an ihrer Abenteuerebene). An einem selbst angelegten
--     Kapitel bleibt `chapter` stehen — es unterscheidet es von einem Arc,
--     und das wegzunehmen hiesse, etwas zu verlieren. Die Peg-Id bleibt,
--     der Importer rechnet sie für ein Kapitel weiter wie für eine Story
--     (`PEG_TYP`), also findet `--only-new` jedes wieder;
--  3. eine importierte Karte, die am Kapitel selbst hängt (`mapOf` → Arc),
--     bekommt ihre eigene Szene (`mode: 'exploration'`, `partOf` das
--     Kapitel), wie der Importer sie seit E-026 anlegt — mit derselben Id
--     (`<Karte>_scene`), damit ein späteres `--only-new` keine zweite
--     anlegt. Die Karte hängt danach an der Szene.
--
-- Gelöscht wird nichts, das etwas sagt: kein Artikel, keine Kante, kein
-- Wort, das die Art nicht schon sagt. Was sich ändert, ist die Art von
-- Kapiteln und Arcs und das Ziel von `mapOf` an Kapitelkarten. Entfernt
-- wird nur `Story.kind` an den Artikeln aus Schritt 2; die Prüfabfrage
-- zählt die Karten, an denen Schritt 2 dabei mehr nähme als `arc` oder ein
-- importiertes `chapter` — so geschrieben 0, und sie bleibt die Stelle, an
-- der eine spätere Änderung an Schritt 2 auffällt.
--
-- verlust: select count(*) from component m join component s on s.entity_id = m.entity_id and s.type = 'Story' where m.type = '__meta' and m.payload->'interfaces'->>0 = 'Story' and s.payload->>'kind' in ('chapter', 'arc') and (s.payload->>'kind' = 'arc' or m.entity_id like 'e5\_%') and jsonb_typeof(s.payload->'kind') <> 'string'

-- 1. Register --------------------------------------------------------------

insert into interface_def (name, label, abstract, extends, schema, area)
select
  'Arc', 'Arc', false, array['Story'],
  '{"type":"object","properties":{"levelFrom":{"type":"number","title":"From level","min":1,"max":20},"levelTo":{"type":"number","title":"To level","min":1,"max":20},"hook":{"type":"string","format":"long","title":"Hook"},"outcome":{"type":"string","format":"long","title":"Outcome"}}}'::json,
  'story'
where exists (select 1 from interface_def)
on conflict (name) do nothing;

-- 2. Kapitel und Arcs --------------------------------------------------------

create temp table t097_arc (id text primary key) on commit drop;
insert into t097_arc
select m.entity_id
  from component m
  join component s on s.entity_id = m.entity_id and s.type = 'Story'
 where m.type = '__meta'
   and m.payload->'interfaces'->>0 = 'Story'
   and s.payload->>'kind' in ('chapter', 'arc');

update component
   set payload = jsonb_set(payload, '{interfaces,0}', '"Arc"')
 where type = '__meta' and entity_id in (select id from t097_arc);

update component
   set payload = payload - 'kind'
 where type = 'Story' and entity_id in (select id from t097_arc)
   and (payload->>'kind' = 'arc' or entity_id like 'e5\_%');

-- Trug die Karte nichts als das Wort, bleibt keine leere stehen.
delete from component
 where type = 'Story' and payload = '{}'::jsonb and entity_id in (select id from t097_arc);

-- 3. Kapitelkarten bekommen ihre Szene -------------------------------------

create temp table t097_karte (karte text primary key, szene text, kapitel text, kante text, name text, n int) on commit drop;
insert into t097_karte
select k.entity_id, k.entity_id || '_scene', r.to_id, r.id,
       coalesce(i.payload->>'name', ''),
       row_number() over (order by k.entity_id)::int
  from component k
  join relation r on r.from_id = k.entity_id and r.type = 'mapOf'
  join component z on z.entity_id = r.to_id and z.type = '__meta' and z.payload->'interfaces'->>0 = 'Arc'
  left join component i on i.entity_id = k.entity_id and i.type = 'Identity'
 where k.type = '__meta'
   and k.payload->'interfaces'->>0 = 'Map'
   and k.entity_id like 'e5\_%'
   and not exists (select 1 from entity e where e.id = k.entity_id || '_scene');

-- Die Nummer zählt hinter der höchsten vorhandenen Szene weiter (`nextId`).
create temp table t097_basis on commit drop as
select coalesce(max(substring(payload->>'id' from '^scene-(\d+)$')::int), 0) as hoechste
  from component
 where type = 'Identity' and payload->>'id' ~ '^scene-\d+$';

insert into entity (id) select szene from t097_karte;

insert into component (entity_id, type, payload)
select t.szene, '__meta', '{"interfaces":["Scene"],"adhoc":[]}'::jsonb from t097_karte t
union all
select t.szene, 'Identity',
       jsonb_build_object('name', t.name, 'id', 'scene-' || lpad((b.hoechste + t.n)::text, 4, '0'))
  from t097_karte t, t097_basis b
union all
select t.szene, 'Status', '{"status":"ready"}'::jsonb from t097_karte t
union all
select t.szene, 'Scene', '{"mode":"exploration"}'::jsonb from t097_karte t
union all
select t.szene, 'Visibility', '{"audience":"gm"}'::jsonb from t097_karte t
union all
select t.szene, 'Name', n.payload
  from t097_karte t join component n on n.entity_id = t.karte and n.type = 'Name';

insert into relation (id, from_id, to_id, type, props, ord)
select t.szene || '~partOf-1', t.szene, t.kapitel, 'partOf', '{}'::jsonb, 1 from t097_karte t
union all
select t.szene || '~inLayer-' || row_number() over (partition by t.szene order by l.id),
       t.szene, l.to_id, 'inLayer', l.props, 0
  from t097_karte t join relation l on l.from_id = t.karte and l.type = 'inLayer';

update relation r
   set to_id = t.szene
  from t097_karte t
 where r.id = t.kante;

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select id from t097_arc)
    or id in (select karte from t097_karte)
    or id in (select szene from t097_karte);

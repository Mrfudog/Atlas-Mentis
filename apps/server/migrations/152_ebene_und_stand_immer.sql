-- Ebene und Stand sind immer da (T-425, REQ-441, E-179, E-182, E-183, E-186).
--
-- 1. Die Parkplatz-Ebene „Unassigned“ (`ly_unassigned`), wenn es sie noch
--    nicht gibt — dieselbe Zeile, die der Start nachzieht (`START_LAYERS`).
--    Eine gewöhnliche Ebene: keine Kampagne schaltet sie auf (E-186).
-- 2. Jede Kampagne ohne Ebene kommt in ihre Kampagnenebene (E-183): die
--    Ebene, die sie aufschaltet, keine Gruppe, keinem Konto gehörend, von
--    keiner anderen Kampagne aufgeschaltet — wie in Migration 069. Der
--    Stapel nimmt Kampagnen aus, sie bleiben überall sichtbar.
-- 3. Jeder andere Artikel ohne Ebene kommt nach „Unassigned“ (E-182) —
--    ausser Ebenen selbst und Instanzen (die lesen ihre Vorlage). Auf dev
--    am 28.10.: 6 Bilder, keines von einem Artikel über eine Kante genannt.
-- 4. Jeder Artikel einer Art mit Stand, aber ohne Stand, bekommt `ready`
--    (E-179 b): ohne Stand galt er schon als fertig (D72), jetzt steht es
--    da. Instanzen nicht — ihr Stand kommt von der Vorlage.
--
-- Nichts wird entfernt: nur Zeilen kommen dazu oder ein leerer Stand wird
-- gefüllt. Ein Artikel nach „Unassigned“ steht danach in keiner laufenden
-- Kampagne, bis die Leitung die Ebene aufschaltet oder ihn verschiebt; die
-- Werkbank listet ihn (Prüfung „Unassigned“).

-- 1 ------------------------------------------------------------ Parkplatz

insert into entity(id)
select 'ly_unassigned'
 where not exists (select 1 from entity where id = 'ly_unassigned');

insert into component(entity_id, type, payload)
select 'ly_unassigned', k.type, k.payload
  from (values
    ('Identity', jsonb_build_object(
       'name', 'Unassigned',
       'id', 'layer-' || lpad((coalesce((select max(substring(x.payload->>'id' from '^layer-(\d+)$')::int)
                                           from component x where x.type = 'Identity'), 0) + 1)::text, 4, '0'),
       'aliases', '[]'::jsonb)),
    ('Status', '{"status":"ready"}'::jsonb),
    ('Description', jsonb_build_object('description',
       'Articles that have no other layer wait here. Move each into the layer it belongs to — the workbench lists them under Unassigned. Switch this layer on in a campaign to see its articles there.')),
    ('Layer', '{"kind":"pack","order":5}'::jsonb),
    ('__meta', '{"interfaces":["Layer"],"adhoc":[]}'::jsonb)
  ) as k(type, payload)
 where not exists (select 1 from component c where c.entity_id = 'ly_unassigned' and c.type = '__meta');

-- 2 ------------------------------------------------- Kampagnen in ihre Ebene

create temp table t425_kebene on commit drop as
select distinct on (a.from_id)
       a.from_id as campaign,
       a.to_id as layer
  from relation a
  join component cm on cm.entity_id = a.from_id and cm.type = '__meta' and cm.payload->'interfaces'->>0 = 'Campaign'
  join component lm on lm.entity_id = a.to_id and lm.type = '__meta' and lm.payload->'interfaces'->>0 = 'Layer'
  left join component lk on lk.entity_id = a.to_id and lk.type = 'Layer'
 where a.type = 'activates'
   and coalesce(a.props->>'mode', '') not in ('compare', 'off')
   and coalesce(lk.payload->>'kind', '') <> 'group'
   and not exists (select 1 from app_user_layer g where g.layer_id = a.to_id and g.owner)
   and not exists (
     select 1 from relation b
       join component bm on bm.entity_id = b.from_id and bm.type = '__meta' and bm.payload->'interfaces'->>0 = 'Campaign'
      where b.type = 'activates' and b.to_id = a.to_id and b.from_id <> a.from_id
        and coalesce(b.props->>'mode', '') not in ('compare', 'off'))
 order by a.from_id,
          coalesce(case when (a.props->>'order') ~ '^-?\d+(\.\d+)?$' then (a.props->>'order')::numeric end,
                   case when (lk.payload->>'order') ~ '^-?\d+(\.\d+)?$' then (lk.payload->>'order')::numeric end,
                   10) desc;

insert into relation(id, from_id, to_id, type, props, ord)
select k.campaign || '~inLayer-1', k.campaign, k.layer, 'inLayer', '{}'::jsonb,
       coalesce((select max(x.ord) from relation x where x.from_id = k.campaign), 0) + 1
  from t425_kebene k
 where not exists (select 1 from relation r where r.from_id = k.campaign and r.type = 'inLayer')
   and not exists (select 1 from relation r where r.id = k.campaign || '~inLayer-1');

-- 3 ------------------------------------------------- übrige nach Unassigned

insert into relation(id, from_id, to_id, type, props, ord)
select m.entity_id || '~inLayer-1', m.entity_id, 'ly_unassigned', 'inLayer', '{}'::jsonb,
       coalesce((select max(x.ord) from relation x where x.from_id = m.entity_id), 0) + 1
  from component m
 where m.type = '__meta'
   and coalesce(m.payload->'interfaces'->>0, '') not in ('Layer', 'RuleSystem', 'RuleMechanic', 'Campaign')
   and m.entity_id <> 'ly_unassigned'
   and not exists (select 1 from relation r where r.from_id = m.entity_id and r.type = 'inLayer')
   and not exists (select 1 from relation r where r.from_id = m.entity_id and r.type = 'instanceOf')
   and not exists (select 1 from relation r where r.id = m.entity_id || '~inLayer-1');

-- 4 ------------------------------------------------------------ Stand ready

create temp table t425_mit_stand on commit drop as
with recursive kette(art, vor) as (
  select name, name from interface_def
  union
  select k.art, e.vor
    from kette k
    join interface_def d on d.name = k.vor
    cross join lateral unnest(coalesce(d.extends, array[]::text[])) as e(vor)
)
select distinct art from kette where vor = 'Status';

insert into component(entity_id, type, payload)
select m.entity_id, 'Status', '{"status":"ready"}'::jsonb
  from component m
 where m.type = '__meta'
   and m.payload->'interfaces'->>0 in (select art from t425_mit_stand)
   and not exists (select 1 from component s where s.entity_id = m.entity_id and s.type = 'Status')
   and not exists (select 1 from relation r where r.from_id = m.entity_id and r.type = 'instanceOf');

update component c
   set payload = c.payload || '{"status":"ready"}'::jsonb
 where c.type = 'Status'
   and coalesce(btrim(c.payload->>'status'), '') = ''
   and not exists (select 1 from relation r where r.from_id = c.entity_id and r.type = 'instanceOf');

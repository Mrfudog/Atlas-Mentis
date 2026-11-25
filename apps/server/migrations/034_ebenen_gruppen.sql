-- Gruppen von Ebenen und Ebenen, die sich selbst beschreiben (T-088, E-022 b,
-- REQ-244, REQ-245).
--
-- Eine Gruppe ist selbst eine Ebene (`Layer.kind: 'group'`), ihre Mitglieder
-- hängen mit `partOf` an ihr; schaltet eine Kampagne die Gruppe auf, sind
-- alle Mitglieder im Spiel. `activates` mit `mode: 'off'` nimmt ein Buch aus
-- einer aufgeschalteten Gruppe heraus. Die Ebene trägt ihr Kürzel,
-- Erscheinen, Autor, Regelstand, Stufen und Handlungsstrang.
--
-- Hier kommen nach, was der Seed nur in eine leere Datenbank schreibt:
--  1. die Registerzeilen (nur, wo schon ein Register steht, wie 028/033);
--  2. die Gruppen-Ebenen des Importers (Id `e5_group_<gruppe>`, wie
--     `gruppeEbeneId`), aber nur, wo eine Buchebene hineingehört;
--  3. je Buchebene ihre Gruppe (`partOf`), ihr Kürzel und die Beschreibung
--     „XGE — Xanathar's Guide to Everything", wo noch keine steht.
--
-- Welche Gruppe, weiss hier nur, was an der Ebene steht: die Marke `core`,
-- `kind: 'adventure'`, das Kürzel (UA, 2024) und eine Liste der bekannten
-- Settings; der Rest sind Supplements. Erscheinen, Autor und die genaue
-- Gruppe aus 5e.tools trägt `import --layers` nach (docs/Betrieb.md), ohne
-- einen Artikel anzufassen. Gelöscht wird nichts; keine Kampagne schaltet
-- etwas anderes auf als vorher.

-- 1. Register --------------------------------------------------------------

-- Die neuen Felder an `Layer`; ein Feld, das am Server schon steht, bleibt.
update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         '{
           "abbreviation": {"type": "string", "title": "Abbreviation"},
           "published": {"type": "string", "title": "Published"},
           "author": {"type": "string", "title": "Author"},
           "levels": {"type": "string", "title": "Levels"},
           "storyline": {"type": "string", "title": "Storyline", "suggest": true}
         }'::jsonb || coalesce(schema::jsonb->'properties', '{}'::jsonb)
       )::json
 where name = 'Layer' and schema is not null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,kind,enum}', (schema::jsonb#>'{properties,kind,enum}') || '["group"]'::jsonb)::json
 where name = 'Layer'
   and jsonb_typeof(schema::jsonb#>'{properties,kind,enum}') = 'array'
   and not ((schema::jsonb#>'{properties,kind,enum}') ? 'group');

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,version,title}', '"Rules version"')::json
 where name = 'Layer'
   and schema::jsonb#>>'{properties,version,title}' = 'Version';

-- Eine Ebene hängt an ihrer Gruppe.
update relation_def set from_ifaces = array_append(from_ifaces, 'Layer')
 where type = 'partOf' and not ('Layer' = any(from_ifaces));
update relation_def set to_ifaces = array_append(to_ifaces, 'Layer')
 where type = 'partOf' and not ('Layer' = any(to_ifaces));

-- `activates` kennt `off`.
update relation_def
   set props = jsonb_set(props, '{properties,mode,enum}', (props#>'{properties,mode,enum}') || '["off"]'::jsonb)
 where type = 'activates'
   and jsonb_typeof(props#>'{properties,mode,enum}') = 'array'
   and not ((props#>'{properties,mode,enum}') ? 'off');

-- 2. Die Buchebenen und ihre Gruppe -----------------------------------------

create temp table t088_gruppe (k text primary key, name text, text text, rang int) on commit drop;
insert into t088_gruppe values
  ('core', 'Core rules', 'The three core rulebooks: Player''s Handbook, Monster Manual and Dungeon Master''s Guide.', 1),
  ('supplement', 'Supplements', 'Rule books that add options, monsters and items to the core rules.', 2),
  ('setting', 'Settings', 'Books that describe a world or a plane, with the rules that belong to it.', 3),
  ('adventure', 'Adventures', 'Published adventures: chapters, scenes, encounters and maps.', 4),
  ('ua', 'Unearthed Arcana', 'Playtest material, not final rules.', 5),
  ('2024', '2024 rules', 'The revised fifth edition of 2024 and the books built on it.', 6),
  ('other', 'Screens & other', 'Screens, recipes and everything else that fits no other group.', 7);

-- Die Kürzel, wie 5e.tools sie schreibt (die Id der Buchebene ist klein
-- geschrieben), und die Settings unter ihnen.
create temp table t088_kuerzel (kuerzel text primary key, setting boolean) on commit drop;
insert into t088_kuerzel values
  ('PHB', false), ('MM', false), ('DMG', false), ('VGM', false), ('XGE', false), ('MTF', false),
  ('TCE', false), ('FTD', false), ('MPMM', false), ('BGG', false), ('BMT', false), ('DMTCRG', false),
  ('SCAG', true), ('GGR', true), ('AI', true), ('ERLW', true), ('EGW', true), ('MOT', true),
  ('VRGR', true), ('SCC', true), ('AAG', true), ('BAM', true), ('SatO', true), ('TDCSR', true),
  ('PSA', true), ('PSK', true), ('PSZ', true), ('PSI', true), ('PSX', true), ('PSD', true),
  ('OGA', false), ('LMoP', false), ('HotDQ', false), ('RoT', false), ('PotA', false), ('OotA', false),
  ('CoS', false), ('SKT', false), ('TftYP', false), ('ToA', false), ('WDH', false), ('WDMM', false),
  ('LLK', false), ('GoS', false), ('DIP', false), ('BGDIA', false), ('IDRotF', false), ('CM', false),
  ('WBtW', false), ('CRCotN', false), ('JttRC', false), ('DSotDQ', false), ('KftGV', false),
  ('PaBTSO', false), ('ToFW', false), ('QftIS', false), ('MPP', false),
  ('XPHB', false), ('XMM', false), ('XDMG', false);

create temp table t088_buch on commit drop as
select e.id,
       i.payload->>'name' as name,
       coalesce(nullif(l.payload->>'abbreviation', ''), k.kuerzel, upper(substring(e.id from '^e5_book_(.+)$'))) as kuerzel,
       case
         when l.payload->>'kind' = 'adventure' then 'adventure'
         when substring(e.id from '^e5_book_(.+)$') like 'ua%' then 'ua'
         when substring(e.id from '^e5_book_(.+)$') in ('xphb', 'xmm', 'xdmg') then '2024'
         when jsonb_typeof(t.payload->'tags') = 'array' and t.payload->'tags' ? 'core' then 'core'
         when k.setting then 'setting'
         else 'supplement'
       end as gruppe
  from entity e
  join component m on m.entity_id = e.id and m.type = '__meta' and m.payload->'interfaces'->>0 = 'Layer'
  join component l on l.entity_id = e.id and l.type = 'Layer'
  left join component i on i.entity_id = e.id and i.type = 'Identity'
  left join component t on t.entity_id = e.id and t.type = 'Tags'
  left join t088_kuerzel k on lower(k.kuerzel) = substring(e.id from '^e5_book_(.+)$')
 where l.payload->>'kind' in ('book', 'adventure')
   and e.id like 'e5_book_%';

-- Die Gruppen, in die ein Buch gehört und die es noch nicht gibt; Nummer
-- weiterzählen (`layer-0063` …), in der Reihenfolge der Kampagnenseite.
create temp table t088_neu on commit drop as
select g.k,
       'e5_group_' || g.k as id,
       g.name,
       g.text,
       'layer-' || lpad((coalesce((select max(substring(c.payload->>'id' from '^layer-(\d+)$')::int)
                                     from component c where c.type = 'Identity'), 0)
                         + row_number() over (order by g.rang))::text, 4, '0') as nummer
  from t088_gruppe g
 where exists (select 1 from t088_buch b where b.gruppe = g.k)
   and not exists (select 1 from entity x where x.id = 'e5_group_' || g.k);

insert into entity(id) select id from t088_neu;

insert into component(entity_id, type, payload)
select n.id, k.type, k.payload
  from t088_neu n
  cross join lateral (values
    ('Identity',    jsonb_build_object('name', n.name, 'id', n.nummer)),
    ('Status',      jsonb_build_object('status', 'ready')),
    ('Layer',       jsonb_build_object('kind', 'group', 'order', 0)),
    ('Description', jsonb_build_object('description', n.text)),
    ('Prose',       jsonb_build_object('paragraph', jsonb_build_array(jsonb_build_object(
                      'id', 'text',
                      'value', n.text || ' A group of layers from 5e.tools: turning it on for a campaign puts every book in it into play; a single book inside can still be turned off.')))),
    ('__meta',      jsonb_build_object('interfaces', jsonb_build_array('Layer'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

-- Jedes Buch an seine Gruppe — nur, wenn es noch an keiner Gruppe des Importers hängt.
insert into relation(id, from_id, to_id, type, props, ord)
select b.id || '~partOf-e5_group_' || b.gruppe,
       b.id,
       'e5_group_' || b.gruppe,
       'partOf',
       '{}'::jsonb,
       coalesce((select max(x.ord) from relation x where x.from_id = b.id), 0) + 1
  from t088_buch b
 where exists (select 1 from entity g where g.id = 'e5_group_' || b.gruppe)
   and not exists (select 1 from relation x where x.from_id = b.id and x.type = 'partOf' and x.to_id like 'e5_group_%');

-- 3. Kürzel und Beschreibung, wo nichts steht --------------------------------

update component c
   set payload = c.payload || jsonb_build_object('abbreviation', b.kuerzel)
  from t088_buch b
 where c.entity_id = b.id and c.type = 'Layer'
   and coalesce(c.payload->>'abbreviation', '') = '';

update component c
   set payload = c.payload || jsonb_build_object('description', b.kuerzel || ' — ' || b.name)
  from t088_buch b
 where c.entity_id = b.id and c.type = 'Description' and b.name is not null
   and coalesce(c.payload->>'description', '') = '';

insert into component(entity_id, type, payload)
select b.id, 'Description', jsonb_build_object('description', b.kuerzel || ' — ' || b.name)
  from t088_buch b
 where b.name is not null
   and not exists (select 1 from component c where c.entity_id = b.id and c.type = 'Description');

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select id from t088_buch) or id in (select id from t088_neu);

do $$
declare
  buecher int;
  gruppen int;
begin
  select count(*) into buecher from t088_buch;
  select count(*) into gruppen from t088_neu;
  if buecher > 0 then
    raise notice 'Gruppen von Ebenen: % Buchebenen eingehängt, % Gruppen neu.', buecher, gruppen;
  end if;
end $$;

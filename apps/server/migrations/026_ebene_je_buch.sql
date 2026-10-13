-- Eine Ebene je Buch (T-081, E-017, REQ-239).
--
-- Bis hier legte der 5e.tools-Importer alles in eine Ebene „D&D 5e (2014)";
-- welches Buch, stand nur in `Source.publication`. Jetzt bringt jedes Buch
-- seine eigene Ebene, und eine Kampagne schaltet die Bücher auf, die sie
-- nutzt. Der Bestand wird **umgehängt, nicht neu eingelesen**: die Artikel
-- behalten Id und Änderungen, nur das Ziel ihrer Kante `inLayer` wechselt.
--
-- Gelöscht wird nichts (T-076):
--  - Was keine Quelle trägt (die Aktionsarten), bleibt in der alten Ebene
--    und wird beim Start aufgezählt; die alte Ebene bleibt, solange etwas
--    darin liegt (hier: immer — sie wird nicht angefasst).
--  - Jede Kampagne, die die alte Ebene aufschaltet, schaltet danach auch
--    jedes Buch auf, in das etwas aus ihr umzog, auf derselben Höhe. Sie
--    sieht also genau, was sie vorher sah; abschalten, was sie nicht
--    braucht, kann die Leitung auf der Kampagnenseite.
--
-- Die Id einer Buchebene ist `e5_book_<kürzel>` wie im Importer
-- (`buchEbeneId`), damit ein späteres `import --only-new` dieselbe Ebene
-- trifft und kein Buch zweimal anlegt. Den Namen kennt hier niemand aus
-- 5e.tools; die Tabelle unten nennt die bekannten Bücher, ein anderes
-- heisst wie sein Kürzel, bis jemand die Ebene umbenennt.

-- Die alte Ebene: die Id, die der Importer ihr gab, oder ihr Name.
create temp table t081_alt on commit drop as
select e.id
  from entity e
  join component m on m.entity_id = e.id and m.type = '__meta' and m.payload->'interfaces'->>0 = 'Layer'
  left join component i on i.entity_id = e.id and i.type = 'Identity'
 where e.id = 'e5_367c46d7f4ff' or i.payload->>'name' = 'D&D 5e (2014)';

-- Je Kante in die alte Ebene das Buch des Artikels: `Source.publication`,
-- sonst die Fundstelle, die der Importer einer Art ohne `Source` als Notiz
-- gab („Source: XGE, p. 12"). Eine Kante, die herausnimmt, bleibt.
create temp table t081_zug on commit drop as
select r.id as rel,
       r.from_id,
       nullif(btrim(coalesce(
         s.payload->>'publication',
         (select substring(n->>'value' from '^Source: ([^,]+)')
            from jsonb_array_elements(case when jsonb_typeof(no.payload->'note') = 'array' then no.payload->'note' else '[]'::jsonb end) n
           where n->>'id' = 'source'
           limit 1)
       )), '') as quelle
  from relation r
  left join component s  on s.entity_id  = r.from_id and s.type  = 'Source'
  left join component no on no.entity_id = r.from_id and no.type = 'Notes'
 where r.type = 'inLayer'
   and r.to_id in (select id from t081_alt)
   and coalesce(r.props->>'mode', 'adds') <> 'removes';

-- Die bekannten Bücher (Titel wie in 5e.tools) und ihre Gruppe auf der
-- Kampagnenseite.
create temp table t081_titel (kuerzel text, name text, gruppe text) on commit drop;
insert into t081_titel values
  ('PHB', 'Player''s Handbook', 'core'),
  ('MM', 'Monster Manual', 'core'),
  ('DMG', 'Dungeon Master''s Guide', 'core'),
  ('SCAG', 'Sword Coast Adventurer''s Guide', 'sourcebook'),
  ('VGM', 'Volo''s Guide to Monsters', 'sourcebook'),
  ('XGE', 'Xanathar''s Guide to Everything', 'sourcebook'),
  ('MTF', 'Mordenkainen''s Tome of Foes', 'sourcebook'),
  ('GGR', 'Guildmasters'' Guide to Ravnica', 'sourcebook'),
  ('AI', 'Acquisitions Incorporated', 'sourcebook'),
  ('ERLW', 'Eberron: Rising from the Last War', 'sourcebook'),
  ('EGW', 'Explorer''s Guide to Wildemount', 'sourcebook'),
  ('MOT', 'Mythic Odysseys of Theros', 'sourcebook'),
  ('TCE', 'Tasha''s Cauldron of Everything', 'sourcebook'),
  ('VRGR', 'Van Richten''s Guide to Ravenloft', 'sourcebook'),
  ('FTD', 'Fizban''s Treasury of Dragons', 'sourcebook'),
  ('SCC', 'Strixhaven: A Curriculum of Chaos', 'sourcebook'),
  ('MPMM', 'Mordenkainen Presents: Monsters of the Multiverse', 'sourcebook'),
  ('AAG', 'Astral Adventurer''s Guide', 'sourcebook'),
  ('BAM', 'Boo''s Astral Menagerie', 'sourcebook'),
  ('BGG', 'Bigby Presents: Glory of the Giants', 'sourcebook'),
  ('BMT', 'The Book of Many Things', 'sourcebook'),
  ('SatO', 'Sigil and the Outlands', 'sourcebook'),
  ('MPP', 'Morte''s Planar Parade', 'sourcebook'),
  ('TDCSR', 'Tal''Dorei Campaign Setting Reborn', 'sourcebook'),
  ('PSA', 'Plane Shift: Amonkhet', 'sourcebook'),
  ('PSK', 'Plane Shift: Kaladesh', 'sourcebook'),
  ('PSZ', 'Plane Shift: Zendikar', 'sourcebook'),
  ('PSI', 'Plane Shift: Innistrad', 'sourcebook'),
  ('PSX', 'Plane Shift: Ixalan', 'sourcebook'),
  ('PSD', 'Plane Shift: Dominaria', 'sourcebook'),
  ('OGA', 'One Grung Above', 'adventure'),
  ('LMoP', 'Lost Mine of Phandelver', 'adventure'),
  ('HotDQ', 'Hoard of the Dragon Queen', 'adventure'),
  ('RoT', 'The Rise of Tiamat', 'adventure'),
  ('PotA', 'Princes of the Apocalypse', 'adventure'),
  ('OotA', 'Out of the Abyss', 'adventure'),
  ('CoS', 'Curse of Strahd', 'adventure'),
  ('SKT', 'Storm King''s Thunder', 'adventure'),
  ('TftYP', 'Tales from the Yawning Portal', 'adventure'),
  ('ToA', 'Tomb of Annihilation', 'adventure'),
  ('WDH', 'Waterdeep: Dragon Heist', 'adventure'),
  ('WDMM', 'Waterdeep: Dungeon of the Mad Mage', 'adventure'),
  ('LLK', 'Lost Laboratory of Kwalish', 'adventure'),
  ('GoS', 'Ghosts of Saltmarsh', 'adventure'),
  ('DIP', 'Dragon of Icespire Peak', 'adventure'),
  ('BGDIA', 'Baldur''s Gate: Descent into Avernus', 'adventure'),
  ('IDRotF', 'Icewind Dale: Rime of the Frostmaiden', 'adventure'),
  ('CM', 'Candlekeep Mysteries', 'adventure'),
  ('WBtW', 'The Wild Beyond the Witchlight', 'adventure'),
  ('CRCotN', 'Critical Role: Call of the Netherdeep', 'adventure'),
  ('JttRC', 'Journeys through the Radiant Citadel', 'adventure'),
  ('DSotDQ', 'Dragonlance: Shadow of the Dragon Queen', 'adventure'),
  ('KftGV', 'Keys from the Golden Vault', 'adventure'),
  ('PaBTSO', 'Phandelver and Below: The Shattered Obelisk', 'adventure'),
  ('ToFW', 'Turn of Fortune''s Wheel', 'adventure'),
  ('QftIS', 'Quests from the Infinite Staircase', 'adventure');

-- Die Bücher, in die etwas umzieht; `neu`, wenn es die Ebene noch nicht gibt.
create temp table t081_buch on commit drop as
select q.k,
       b.id,
       coalesce(t.name, q.quelle) as name,
       coalesce(t.kuerzel, q.quelle) as kuerzel,
       coalesce(t.gruppe, 'sourcebook') as gruppe,
       not exists (select 1 from entity x where x.id = b.id) as neu
  from (select lower(quelle) as k, min(quelle) as quelle from t081_zug where quelle is not null group by lower(quelle)) q
  cross join lateral (select 'e5_book_' || btrim(regexp_replace(q.k, '[^a-z0-9]+', '-', 'g'), '-') as id) b
  left join t081_titel t on lower(t.kuerzel) = q.k
 where b.id <> 'e5_book_';

-- Die neuen Ebenen: Nummer weiterzählen (`layer-0002` …), Grundregelwerke zuerst.
create temp table t081_nummer on commit drop as
select b.id,
       'layer-' || lpad((coalesce((select max(substring(c.payload->>'id' from '^layer-(\d+)$')::int)
                                     from component c where c.type = 'Identity'), 0)
                         + row_number() over (order by b.gruppe <> 'core', b.gruppe, b.name))::text, 4, '0') as nummer
  from t081_buch b
 where b.neu;

insert into entity(id) select id from t081_buch where neu;

insert into component(entity_id, type, payload)
select b.id, k.type, k.payload
  from t081_buch b
  join t081_nummer n on n.id = b.id
  cross join lateral (values
    ('Identity', jsonb_build_object('name', b.name, 'id', n.nummer)),
    ('Status',   jsonb_build_object('status', 'ready')),
    ('Layer',    jsonb_build_object('kind', 'book', 'order', 0, 'version', '2014')),
    ('Tags',     jsonb_build_object('tags', jsonb_build_array(b.gruppe))),
    ('Prose',    jsonb_build_object('paragraph', jsonb_build_array(jsonb_build_object(
                   'id', 'text',
                   'value', b.name || ' (' || b.kuerzel || '), taken over from 5e.tools. Turn it on for a campaign to bring its articles into play.')))),
    ('__meta',   jsonb_build_object('interfaces', jsonb_build_array('Layer'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

-- Umhängen: nur das Ziel der Kante wechselt.
update relation r
   set to_id = b.id
  from t081_zug z
  join t081_buch b on b.k = lower(z.quelle)
 where r.id = z.rel;

-- Jede Kampagne, die die alte Ebene aufschaltet, schaltet die Bücher auf
-- derselben Höhe dazu (dieselben `props`, also dieselbe `order`).
insert into relation(id, from_id, to_id, type, props, ord)
select a.from_id || '~activates-' || b.id,
       a.from_id,
       b.id,
       'activates',
       a.props,
       coalesce((select max(x.ord) from relation x where x.from_id = a.from_id), 0)
         + row_number() over (partition by a.from_id order by b.gruppe <> 'core', b.gruppe, b.name)
  from relation a
  cross join t081_buch b
 where a.type = 'activates'
   and a.to_id in (select id from t081_alt)
   and not exists (select 1 from relation x where x.from_id = a.from_id and x.type = 'activates' and x.to_id = b.id);

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select from_id from t081_zug where quelle is not null)
    or id in (select id from t081_buch)
    or id in (select from_id from relation where type = 'activates' and to_id in (select id from t081_buch));

-- Aufzählen, was wohin ging und was ohne Quelle in der alten Ebene blieb.
do $$
declare
  umgezogen int;
  buecher int;
  geblieben int;
  namen text;
begin
  select count(*) into umgezogen from t081_zug where quelle is not null;
  select count(*) into buecher from t081_buch;
  select count(*) into geblieben from t081_zug where quelle is null;
  if umgezogen + geblieben = 0 then
    return;
  end if;
  raise notice 'Eine Ebene je Buch: % Artikel in % Buchebenen umgehängt.', umgezogen, buecher;
  if geblieben > 0 then
    select string_agg(coalesce(i.payload->>'name', z.from_id), ', ' order by i.payload->>'name')
      into namen
      from (select from_id from t081_zug where quelle is null limit 50) z
      left join component i on i.entity_id = z.from_id and i.type = 'Identity';
    raise notice 'Ohne Quelle in der alten Ebene geblieben (%): %', geblieben,
      namen || case when geblieben > 50 then ' …' else '' end;
  end if;
end $$;

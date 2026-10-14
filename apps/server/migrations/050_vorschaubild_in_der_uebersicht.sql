-- Das Vorschaubild in der Übersicht (T-114).
--
-- Bilder lassen sich hochladen; in einer Listenzeile steht seither ein
-- Daumennagel neben dem Namen — wenn die Anordnung `overview` der Art das
-- Element `image` trägt. Der Seed schreibt nur in eine leere Datenbank;
-- hier kommt es in eine bestehende: in die Grundanordnung `overview` und
-- in die eigenen Übersichten der Arten, die ein Bild tragen (Kreatur,
-- Klasse, Unterklasse, Abstammung, Gefahr, Gottheit, Statblock,
-- Gegenstand, Waffe, Rüstung). **Nur, wo noch kein `image` steht**; eine
-- Anordnung, die jemand umgebaut hat, bekommt das Bild vorne dazu und
-- behält alles andere. Entfernt wird nichts.

update view_def
   set config = jsonb_set(config, '{layout}', '[{"id":"ov-img","el":"image"}]'::jsonb || coalesce(config->'layout', '[]'::jsonb))
                || '{"image": true}'::jsonb
 where key = 'overview'
   and jsonb_typeof(config->'layout') = 'array'
   and not exists (select 1 from jsonb_array_elements(config->'layout') y where y->>'el' = 'image');

update interface_def d
   set views = jsonb_set(d.views, '{overview}', jsonb_build_array(jsonb_build_object('id', x.pre || '-ov-img', 'el', 'image')) || (d.views->'overview'))
  from (values ('Creature', 'c'), ('Class', 'cla'), ('Subclass', 'sub'), ('Ancestry', 'anc'), ('Hazard', 'haz'),
               ('Deity', 'dei'), ('Statblock', 's'), ('Item', 'ite'), ('Weapon', 'wea'), ('Armor', 'arm')) as x(name, pre)
 where d.name = x.name
   and jsonb_typeof(d.views->'overview') = 'array'
   and not exists (select 1 from jsonb_array_elements(d.views->'overview') y where y->>'el' = 'image');

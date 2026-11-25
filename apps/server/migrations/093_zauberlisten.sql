-- Zauberlisten (T-212): die Kante `spellList` von Klasse und Unterklasse
-- zum Zauber — welche Zauber eine Klasse lernen oder vorbereiten darf.
-- Nicht `grants`: dessen Ziele bringen ihre Wirkungen ohne Bedingung an die
-- Figur (`effectsAt`). „Usable by" liest sie mit dem Grad des Zaubers.
--
-- Wie 090 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert. Die Kanten selbst kommen
-- über eine Massenänderung (scripts/zauberlisten-5etools.mjs).

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'spellList', 'spell list', 'on the spell list of', '{Class,Subclass}'::text[], '{Spell}'::text[], false, 'many',
       '{"type":"object","properties":{"optional":{"type":"boolean","title":"Optional (expanded list)"}}}'::jsonb,
       'A class or subclass has a spell on its spell list; the spell lists the classes that may learn it.'
where exists (select 1 from relation_def)
on conflict (type) do nothing;

update relation_def
   set facet = '{"label":"Class spell list","order":0}'::jsonb
 where type = 'spellList'
   and facet is null;

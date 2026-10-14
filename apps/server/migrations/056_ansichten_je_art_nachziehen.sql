-- Die Ansichten je Art auf bestehenden Datenbanken nachziehen (T-090).
--
-- Die Anordnungen aus W2 (Statblock, Zauber und Gegenstand wie im Buch,
-- T-011/T-012) und die Spalten im Kompendium je Art (`overview`, T-017)
-- standen nur in den Startzeilen. Der Seed schreibt Arten aber nur in eine
-- leere Datenbank, und keine Migration hat sie nachgetragen — 053 setzte
-- das Vorschaubild nur dort, wo eine `overview` schon stand. Auf dev
-- (gefunden in der Sichtprüfung T-090, 14.10.):
--
-- - das Kompendium zeigte je Art **keine Spalten** (`/api/list` →
--   `columns: []`) und keine Vorschaubilder;
-- - Zauber und Gegenstände hatten keine eigene `full`, also keinen Bogen
--   wie im Buch;
-- - der Statblock stand noch in der ersten Anordnung (Feldtabelle und
--   Teile) statt im Bogen — Marilith, Lich: „STR 18" als Tabellenzelle.
--
-- Zwei Schritte, beide nach dem Muster von 052:
--
-- 1. **Nur, wo die Art für diese Ansicht noch nichts sagt**, kommt die
--    Startzeile dazu (20 Paare, Stand `packages/registry` vom 14.10.).
--    Was jemand im Register eingestellt hat, bleibt.
-- 2. `Statblock` `full` und `quick` werden ersetzt, **nur wenn sie noch
--    genau so stehen, wie der erste Seed sie anlegte**. Eine eigene
--    Anordnung bleibt.
--
-- Entfernt wird nichts, kein Artikel wird geändert.

update interface_def i
   set views = z.neu || coalesce(i.views, '{}'::jsonb)
  from (
    select art, jsonb_object_agg(ansicht, wert) as neu
      from (values
        ('Creature', 'overview', '[{"id":"c-ov-img","el":"image"},{"id":"c-ov","el":"fields","fields":["Creature.kind","Creature.species","Creature.role"]}]'::jsonb),
        ('Rule', 'overview', '[{"id":"rul-ov","el":"fields","fields":["Rule.kind"]}]'::jsonb),
        ('Feat', 'overview', '[{"id":"fea-ov","el":"fields","fields":["Feat.prerequisite","Feat.repeatable"]}]'::jsonb),
        ('Language', 'overview', '[{"id":"lan-ov","el":"fields","fields":["Language.languageType","Language.script"]}]'::jsonb),
        ('Class', 'overview', '[{"id":"cla-ov-img","el":"image"},{"id":"cla-ov","el":"fields","fields":["Class.hitDie","Class.primaryAbility","Class.casterProgression"]}]'::jsonb),
        ('Subclass', 'overview', '[{"id":"sub-ov-img","el":"image"},{"id":"sub-ov","el":"fields","fields":["Subclass.shortName","Subclass.casterProgression"]}]'::jsonb),
        ('Ancestry', 'overview', '[{"id":"anc-ov-img","el":"image"},{"id":"anc-ov","el":"fields","fields":["Ancestry.size","Ancestry.speed"]}]'::jsonb),
        ('Condition', 'overview', '[{"id":"con-ov","el":"fields","fields":["Condition.kind"]}]'::jsonb),
        ('Action', 'overview', '[{"id":"act-ov","el":"fields","fields":["Action.actionType","Action.attack","Action.damageType","Action.recharge"]}]'::jsonb),
        ('Feature', 'overview', '[{"id":"ftr-ov","el":"fields","fields":["Feature.featureType"]}]'::jsonb),
        ('Spell', 'overview', '[{"id":"spe-ov","el":"fields","fields":["Spell.level","Spell.school","Spell.duration","Spell.concentration","Spell.ritual"]}]'::jsonb),
        ('Spell', 'full', '[{"id":"sp-book","el":"spell"},{"id":"sp-f","el":"fields","fields":"all","except":["Spell"]},{"id":"sp-b","el":"prose","fields":"all","except":["Prose.paragraph"]},{"id":"sp-c","el":"composed"},{"id":"sp-used","el":"usedBy"},{"id":"sp-r","el":"relations"}]'::jsonb),
        ('Hazard', 'overview', '[{"id":"haz-ov-img","el":"image"},{"id":"haz-ov","el":"fields","fields":["Hazard.kind","Hazard.category","Hazard.threat"]}]'::jsonb),
        ('Deity', 'overview', '[{"id":"dei-ov-img","el":"image"},{"id":"dei-ov","el":"fields","fields":["Deity.pantheon","Deity.alignment","Deity.domains"]}]'::jsonb),
        ('Statblock', 'overview', '[{"id":"s-ov-img","el":"image"},{"id":"s-ov","el":"fields","fields":["Statblock.cr","Statblock.size","Statblock.creatureType","Statblock.alignment"]}]'::jsonb),
        ('Item', 'overview', '[{"id":"ite-ov-img","el":"image"},{"id":"ite-ov","el":"fields","fields":["Item.itemType","Item.rarity","Item.attunement"]}]'::jsonb),
        ('Item', 'full', '[{"id":"it-img","el":"image"},{"id":"it-book","el":"item"},{"id":"it-desc","el":"description"},{"id":"it-f","el":"fields","fields":"all","except":["Item","Weapon","Armor","Material"]},{"id":"it-linked","el":"linked"},{"id":"it-b","el":"prose","fields":"all"},{"id":"it-c","el":"composed"},{"id":"it-used","el":"usedBy"},{"id":"it-stand","el":"standing"},{"id":"it-r","el":"relations"}]'::jsonb),
        ('Weapon', 'overview', '[{"id":"wea-ov-img","el":"image"},{"id":"wea-ov","el":"fields","fields":["Weapon.category","Weapon.damage","Weapon.damageType","Item.rarity"]}]'::jsonb),
        ('Armor', 'overview', '[{"id":"arm-ov-img","el":"image"},{"id":"arm-ov","el":"fields","fields":["Armor.armorType","Armor.ac","Armor.strength","Armor.stealthDisadvantage"]}]'::jsonb),
        ('Table', 'overview', '[{"id":"t-ov","el":"fields","fields":["Table.kind","Table.die"]}]'::jsonb)
      ) as v(art, ansicht, wert)
     group by art
  ) z
 where i.name = z.art;

update interface_def
   set views = jsonb_set(views, '{full}', '[{"id":"s-sb","el":"statblock"},{"id":"s-f","el":"fields","fields":"all","except":["Statblock","Abilities","Proficiencies"]},{"id":"s-b","el":"prose","fields":"all"},{"id":"s-used","el":"usedBy"},{"id":"s-r","el":"relations"}]'::jsonb)
 where name = 'Statblock'
   and views -> 'full' = '[{"el":"fields","id":"s-f","fields":"all"},{"el":"composed","id":"s-c"},{"el":"prose","id":"s-b","fields":"all"},{"el":"relations","id":"s-r"}]'::jsonb;

update interface_def
   set views = jsonb_set(views, '{quick}', '[{"id":"s-q-sb","el":"statblock"}]'::jsonb)
 where name = 'Statblock'
   and views -> 'quick' = '[{"el":"fields","id":"s-q-f","fields":"all"},{"el":"composed","id":"s-q-c"}]'::jsonb;

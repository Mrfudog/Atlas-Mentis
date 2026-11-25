-- Die ersten sinnvollen Ansichten je Art (T-110 Schritt 7, REQ-256).
--
-- Dieselben Zeilen wie `packages/registry/src/ansichten.ts` (ein Test
-- prüft, dass beide gleich sind): die Karte (`quick`) nimmt je Art die
-- zwei, drei Werte, an denen man eine Sache erkennt, der Druck (`print`)
-- setzt Statblock, Zauber und Gegenstand wie im Buch obenan — alles als
-- Anpassung (`{ "adjust": … }`), die über der Ansicht gilt.
--
-- **Nur, wo die Art für diese Ansicht noch nichts sagt.** Was jemand im
-- Register schon eingestellt hat, bleibt, wie es ist. Dazu die eigene
-- Ansicht `handout`, wenn es sie noch nicht gibt, und der Druck ohne den
-- Vorbereitungsstand (`except: Status`, ohne Rest) — nur, wo er noch so
-- steht, wie 050 ihn anlegte. Entfernt wird nichts.

-- Je Art zusammengefasst: ein UPDATE … FROM mit zwei Zeilen für dieselbe
-- Art schriebe nur eine davon. Rechts von `||` gewinnt — also das, was
-- schon dasteht.
update interface_def i
   set views = z.neu || coalesce(i.views, '{}'::jsonb)
  from (
    select art, jsonb_object_agg(ansicht, wert) as neu
      from (values
        ('Spell', 'quick', '{"adjust":{"add":{"q-f":["Spell.level","Spell.school","Spell.concentration","Spell.ritual"]}}}'::jsonb),
        ('Spell', 'print', '{"adjust":{"extra":[{"id":"p-spell","el":"spell"}],"order":["p-spell"]}}'::jsonb),
        ('Class', 'quick', '{"adjust":{"add":{"q-f":["Class.hitDie","Class.primaryAbility"]}}}'::jsonb),
        ('Ancestry', 'quick', '{"adjust":{"add":{"q-f":["Ancestry.size"]}}}'::jsonb),
        ('Feat', 'quick', '{"adjust":{"add":{"q-f":["Feat.prerequisite"]}}}'::jsonb),
        ('Rule', 'quick', '{"adjust":{"add":{"q-f":["Rule.kind"]}}}'::jsonb),
        ('Statblock', 'print', '{"adjust":{"drop":["p-c"],"extra":[{"id":"p-statblock","el":"statblock"}],"order":["p-statblock"]}}'::jsonb),
        ('Item', 'quick', '{"adjust":{"add":{"q-f":["Item.itemType","Item.rarity","Item.attunement"]}}}'::jsonb),
        ('Item', 'print', '{"adjust":{"extra":[{"id":"p-item","el":"item"}],"order":["p-item"]}}'::jsonb),
        ('Weapon', 'quick', '{"adjust":{"add":{"q-f":["Weapon.category","Weapon.damage","Weapon.damageType"]}}}'::jsonb),
        ('Armor', 'quick', '{"adjust":{"add":{"q-f":["Armor.armorType","Armor.ac"]}}}'::jsonb),
        ('Creature', 'quick', '{"adjust":{"add":{"q-f":["Creature.kind","Creature.species","Creature.role","Creature.attitude"]}}}'::jsonb),
        ('Place', 'quick', '{"adjust":{"add":{"q-f":["Place.kind","Place.environment"]}}}'::jsonb),
        ('Faction', 'quick', '{"adjust":{"add":{"q-f":["Faction.kind","Faction.goal"]}}}'::jsonb),
        ('Deity', 'quick', '{"adjust":{"add":{"q-f":["Deity.pantheon","Deity.alignment"]}}}'::jsonb),
        ('Hazard', 'quick', '{"adjust":{"add":{"q-f":["Hazard.kind","Hazard.threat"]}}}'::jsonb),
        ('Scene', 'quick', '{"adjust":{"add":{"q-f":["Scene.mode","Difficulty"]}}}'::jsonb),
        ('Quest', 'quick', '{"adjust":{"add":{"q-f":["Quest.progress","Quest.reward"]}}}'::jsonb)
      ) as v(art, ansicht, wert)
     group by art
  ) z
 where i.name = z.art;

insert into view_def (key, label, ord, config)
values ('handout', 'Handout', 5, '{"label":"Handout","order":5,"fields":"none","description":true,"composed":false,"relations":false,"bindings":true,"image":true,"layout":[{"id":"h-img","el":"image"},{"id":"h-desc","el":"description"},{"id":"h-b","el":"prose","fields":["Prose.paragraph","ReadAloud.readaloud"]}]}'::jsonb)
on conflict (key) do nothing;

update view_def
   set config = '{"label":"Print","order":4,"fields":"all","description":true,"composed":true,"relations":false,"bindings":true,"image":false,"layout":[{"id":"p-desc","el":"description"},{"id":"p-f","el":"fields","fields":"all","except":["Status"]},{"id":"p-b","el":"prose","fields":"all"},{"id":"p-parts","el":"parts"},{"id":"p-c","el":"composed"}]}'::jsonb
 where key = 'print'
   and config = '{"label":"Print","order":4,"fields":"all","description":true,"composed":true,"relations":false,"bindings":true,"image":false,"rest":true,"layout":[{"id":"p-desc","el":"description"},{"id":"p-f","el":"fields","fields":"all"},{"id":"p-b","el":"prose","fields":"all"},{"id":"p-parts","el":"parts"},{"id":"p-c","el":"composed"}]}'::jsonb;

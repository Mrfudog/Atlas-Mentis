-- Ansichten je Art und Stufe (T-234, docs/vorschlaege/Ansichten-Bedarf.md).
--
-- Dieselben Zeilen wie `packages/registry/src/ansichten.ts` (ein Test
-- prüft es, `ansichten.test.ts`):
--
-- 1. Der Handzettel (`handout`) bekommt ein leeres Feldelement `h-f`, wie
--    Karte und Suche — welche Werte auf den Zettel gehören, sagt die Art.
-- 2. Je Art die Werte für den Zettel (Gegenstand, Waffe, Rüstung, Kreatur,
--    Ort, Fraktion, Gottheit, Auftrag) und der Zauber als Karte.
-- 3. Die Karte (`quick`) für Arten, die bisher nur Bild und Satz zeigten:
--    Begegnung, Karte, Rezept, Gruppe, Ereignis, Geschichte, Arc.
-- 4. Das „+" der Suche (`search`) mit denselben Werten wie die Karte.
--
-- **Nur, wo die Art für diese Ansicht noch nichts sagt**, und der Zettel
-- nur, wo er noch so steht, wie 052 ihn anlegte — was jemand im Register
-- oder im Designer eingestellt hat, bleibt. Entfernt wird nichts, kein
-- Artikel geändert.

update interface_def i
   set views = z.neu || coalesce(i.views, '{}'::jsonb)
  from (
    select art, jsonb_object_agg(ansicht, wert) as neu
      from (values
        ('Spell', 'handout', '{"adjust":{"drop":["h-desc"],"extra":[{"id":"h-spell","el":"spell"}],"order":["h-img","h-spell"]}}'::jsonb),
        ('Spell', 'search', '{"adjust":{"add":{"s-f":["Spell.level","Spell.school","Spell.concentration","Spell.ritual"]}}}'::jsonb),
        ('Class', 'search', '{"adjust":{"add":{"s-f":["Class.hitDie","Class.primaryAbility"]}}}'::jsonb),
        ('Ancestry', 'search', '{"adjust":{"add":{"s-f":["Ancestry.size"]}}}'::jsonb),
        ('Feat', 'search', '{"adjust":{"add":{"s-f":["Feat.prerequisite"]}}}'::jsonb),
        ('Rule', 'search', '{"adjust":{"add":{"s-f":["Rule.kind"]}}}'::jsonb),
        ('Item', 'handout', '{"adjust":{"add":{"h-f":["Item.itemType","Item.rarity","Item.attunement"]}}}'::jsonb),
        ('Item', 'search', '{"adjust":{"add":{"s-f":["Item.itemType","Item.rarity","Item.attunement"]}}}'::jsonb),
        ('Weapon', 'handout', '{"adjust":{"add":{"h-f":["Weapon.category","Weapon.damage","Weapon.damageType"]}}}'::jsonb),
        ('Weapon', 'search', '{"adjust":{"add":{"s-f":["Weapon.category","Weapon.damage","Weapon.damageType"]}}}'::jsonb),
        ('Armor', 'handout', '{"adjust":{"add":{"h-f":["Armor.armorType","Armor.ac"]}}}'::jsonb),
        ('Armor', 'search', '{"adjust":{"add":{"s-f":["Armor.armorType","Armor.ac"]}}}'::jsonb),
        ('Creature', 'handout', '{"adjust":{"add":{"h-f":["Creature.species"]}}}'::jsonb),
        ('Creature', 'search', '{"adjust":{"add":{"s-f":["Creature.kind","Creature.species","Creature.role","Creature.attitude"]}}}'::jsonb),
        ('Place', 'handout', '{"adjust":{"add":{"h-f":["Place.kind","Place.environment"]}}}'::jsonb),
        ('Place', 'search', '{"adjust":{"add":{"s-f":["Place.kind","Place.environment"]}}}'::jsonb),
        ('Faction', 'handout', '{"adjust":{"add":{"h-f":["Faction.kind"]}}}'::jsonb),
        ('Faction', 'search', '{"adjust":{"add":{"s-f":["Faction.kind","Faction.goal"]}}}'::jsonb),
        ('Deity', 'handout', '{"adjust":{"add":{"h-f":["Deity.pantheon","Deity.domains"]}}}'::jsonb),
        ('Deity', 'search', '{"adjust":{"add":{"s-f":["Deity.pantheon","Deity.alignment"]}}}'::jsonb),
        ('Hazard', 'search', '{"adjust":{"add":{"s-f":["Hazard.kind","Hazard.threat"]}}}'::jsonb),
        ('Encounter', 'quick', '{"adjust":{"add":{"q-f":["Encounter.kind","Encounter.phase","Difficulty"]}}}'::jsonb),
        ('Encounter', 'search', '{"adjust":{"add":{"s-f":["Encounter.kind","Encounter.phase","Difficulty"]}}}'::jsonb),
        ('Map', 'quick', '{"adjust":{"add":{"q-f":["Map.kind"]}}}'::jsonb),
        ('Map', 'search', '{"adjust":{"add":{"s-f":["Map.kind"]}}}'::jsonb),
        ('Recipe', 'quick', '{"adjust":{"add":{"q-f":["Recipe.trade","Recipe.time"]}}}'::jsonb),
        ('Recipe', 'search', '{"adjust":{"add":{"s-f":["Recipe.trade","Recipe.time"]}}}'::jsonb),
        ('Party', 'quick', '{"adjust":{"add":{"q-f":["Party.level","Party.motto"]}}}'::jsonb),
        ('Party', 'search', '{"adjust":{"add":{"s-f":["Party.level","Party.motto"]}}}'::jsonb),
        ('Event', 'quick', '{"adjust":{"add":{"q-f":["Event.kind","Time.display"]}}}'::jsonb),
        ('Event', 'search', '{"adjust":{"add":{"s-f":["Event.kind","Time.display"]}}}'::jsonb),
        ('Story', 'quick', '{"adjust":{"add":{"q-f":["Story.kind","Story.played"]}}}'::jsonb),
        ('Story', 'search', '{"adjust":{"add":{"s-f":["Story.kind","Story.played"]}}}'::jsonb),
        ('Arc', 'quick', '{"adjust":{"add":{"q-f":["Arc.levelFrom","Arc.levelTo"]}}}'::jsonb),
        ('Arc', 'search', '{"adjust":{"add":{"s-f":["Arc.levelFrom","Arc.levelTo"]}}}'::jsonb),
        ('Scene', 'search', '{"adjust":{"add":{"s-f":["Scene.mode","Difficulty"]}}}'::jsonb),
        ('Quest', 'handout', '{"adjust":{"add":{"h-f":["Quest.progress","Quest.reward"]}}}'::jsonb),
        ('Quest', 'search', '{"adjust":{"add":{"s-f":["Quest.progress","Quest.reward"]}}}'::jsonb)
      ) as v(art, ansicht, wert)
     group by art
  ) z
 where i.name = z.art;

update view_def
   set config = '{"label":"Handout","order":5,"fields":"none","description":true,"composed":false,"relations":false,"bindings":true,"image":true,"layout":[{"id":"h-img","el":"image"},{"id":"h-desc","el":"description"},{"id":"h-f","el":"fields","fields":[]},{"id":"h-b","el":"prose","fields":["Prose.paragraph","ReadAloud.readaloud"]}]}'::jsonb
 where key = 'handout'
   and config = '{"label":"Handout","order":5,"fields":"none","description":true,"composed":false,"relations":false,"bindings":true,"image":true,"layout":[{"id":"h-img","el":"image"},{"id":"h-desc","el":"description"},{"id":"h-b","el":"prose","fields":["Prose.paragraph","ReadAloud.readaloud"]}]}'::jsonb;

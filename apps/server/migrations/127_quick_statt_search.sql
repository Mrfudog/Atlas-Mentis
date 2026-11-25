-- Die Suche zeigt die Kurzansicht; quick neu geordnet (T-346).
--
-- Die Leitung (21.10.): „search ist meist wie quick" — seit T-234 war die
-- Ansicht `search` an jeder Art aus `quick` abgeleitet, also zweimal
-- dasselbe. Das „+" der Suche fragt jetzt nach `quick`, und `quick`
-- stellt das Relevanteste nach oben und das Bild ans Ende, wo der
-- Kartenrahmen es abschneiden darf.
--
-- 1. Die Grundanordnung von `quick`: Werte, Satz, Passagen, Bild.
-- 2. Je Art die neuen Kennwerte und die Reihenfolge (Kreatur, Statblock).
-- 3. Die Anordnungen je Art für `search` gehen, und die Ansicht `search`
--    selbst. Eine Kachel, die `search` nennt (die Oberfläche bot es nie
--    an, also erwartet: keine), nennt danach `quick` — die Prüfabfrage
--    zählt sie. Was den Ort sonst noch nennt (ein Link), liest sich als
--    `quick` (`RETIRED_PLACES`), beim Lesen und ohne Fehler.
-- 4. Eine im Designer gestaltete Ansicht der Gruppe `search` kommt in die
--    Gruppe `quick` — als Variante, sie geht nicht verloren.
--
-- **Nur, wo noch steht, was das Register gebracht hat** — jede Zeile wird
-- mit ihrem alten Wert verglichen. Was jemand im Register oder im Designer
-- eingestellt hat, bleibt, auch eine geänderte Ansicht `search` (dann als
-- eigene Ansicht). Kein Artikel wird geändert, und entfernt wird nur, was
-- unverändert aus dem Register kam — also nichts, das jemand eingetragen
-- hätte.
--
-- verlust: select count(*) from relation where type = 'placed' and props->>'view' = 'search'

update view_def
   set config = '{"label":"Quick","order":2,"fields":"none","description":true,"composed":false,"relations":true,"bindings":false,"image":true,"layout":[{"id":"q-f","el":"fields","fields":[]},{"id":"q-desc","el":"description"},{"id":"q-b","el":"prose","fields":["Prose.paragraph","ReadAloud.readaloud"]},{"id":"q-img","el":"image"}]}'::jsonb
 where key = 'quick'
   and config = '{"label":"Quick","order":2,"fields":"none","description":true,"composed":false,"relations":true,"bindings":false,"image":true,"layout":[{"id":"q-img","el":"image"},{"id":"q-desc","el":"description"},{"id":"q-f","el":"fields","fields":[]},{"id":"q-b","el":"prose","fields":["Prose.paragraph","ReadAloud.readaloud"]}]}'::jsonb;

update interface_def i
   set views = jsonb_set(i.views, '{quick}', v.neu)
  from (values
        ('Creature', '{"adjust":{"add":{"q-f":["Creature.kind","Creature.species","Creature.role","Creature.attitude"]},"extra":[{"id":"c-q-stats","el":"stats"}],"order":["q-img","c-q-stats"]}}'::jsonb, '{"adjust":{"add":{"q-f":["Creature.kind","Creature.species","Creature.role","Creature.attitude"]},"extra":[{"id":"c-q-stats","el":"stats"}],"order":["c-q-stats"]}}'::jsonb),
        ('Place', '{"adjust":{"add":{"q-f":["Place.kind","Place.environment"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Place.kind","Place.environment","Place.state"]}}}'::jsonb),
        ('Feat', '{"adjust":{"add":{"q-f":["Feat.prerequisite"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Feat.prerequisite","Feat.repeatable"]}}}'::jsonb),
        ('Class', '{"adjust":{"add":{"q-f":["Class.hitDie","Class.primaryAbility"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Class.hitDie","Class.primaryAbility","Class.spellAbility"]}}}'::jsonb),
        ('Ancestry', '{"adjust":{"add":{"q-f":["Ancestry.size"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Ancestry.size","Ancestry.speed","Ancestry.creatureType","Ancestry.darkvision"]}}}'::jsonb),
        ('Spell', '{"adjust":{"add":{"q-f":["Spell.level","Spell.school","Spell.concentration","Spell.ritual"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Spell.level","Spell.school","Spell.castingAction","Spell.range","Spell.concentration","Spell.ritual"]}}}'::jsonb),
        ('Hazard', '{"adjust":{"add":{"q-f":["Hazard.kind","Hazard.threat"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Hazard.kind","Hazard.tier","Hazard.threat","Hazard.trigger"]}}}'::jsonb),
        ('Deity', '{"adjust":{"add":{"q-f":["Deity.pantheon","Deity.alignment"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Deity.pantheon","Deity.title","Deity.alignment","Deity.domains"]}}}'::jsonb),
        ('Statblock', '[{"id":"s-q-img","el":"image"},{"id":"s-q-stats","el":"stats"}]'::jsonb, '[{"id":"s-q-stats","el":"stats"},{"id":"s-q-img","el":"image"}]'::jsonb),
        ('Item', '{"adjust":{"add":{"q-f":["Item.itemType","Item.rarity","Item.attunement"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Item.itemType","Item.rarity","Item.attunement","Item.weight"]}}}'::jsonb),
        ('Armor', '{"adjust":{"add":{"q-f":["Armor.armorType","Armor.ac"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Armor.armorType","Armor.ac","Armor.strength","Armor.stealthDisadvantage"]}}}'::jsonb),
        ('Quest', '{"adjust":{"add":{"q-f":["Quest.progress","Quest.reward"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Quest.progress","Quest.reward","Quest.deadline"]}}}'::jsonb),
        ('Recipe', '{"adjust":{"add":{"q-f":["Recipe.trade","Recipe.time"]}}}'::jsonb, '{"adjust":{"add":{"q-f":["Recipe.trade","Recipe.tool","Recipe.dc","Recipe.time"]}}}'::jsonb)
  ) as v(art, alt, neu)
 where i.name = v.art
   and i.views -> 'quick' = v.alt;

update interface_def i
   set views = i.views - 'search'
  from (values
        ('Creature', '{"adjust":{"add":{"s-f":["Creature.kind","Creature.species","Creature.role","Creature.attitude"]}}}'::jsonb),
        ('Place', '{"adjust":{"add":{"s-f":["Place.kind","Place.environment"]}}}'::jsonb),
        ('Faction', '{"adjust":{"add":{"s-f":["Faction.kind","Faction.goal"]}}}'::jsonb),
        ('Rule', '{"adjust":{"add":{"s-f":["Rule.kind"]}}}'::jsonb),
        ('Feat', '{"adjust":{"add":{"s-f":["Feat.prerequisite"]}}}'::jsonb),
        ('Class', '{"adjust":{"add":{"s-f":["Class.hitDie","Class.primaryAbility"]}}}'::jsonb),
        ('Ancestry', '{"adjust":{"add":{"s-f":["Ancestry.size"]}}}'::jsonb),
        ('Spell', '{"adjust":{"add":{"s-f":["Spell.level","Spell.school","Spell.concentration","Spell.ritual"]}}}'::jsonb),
        ('Hazard', '{"adjust":{"add":{"s-f":["Hazard.kind","Hazard.threat"]}}}'::jsonb),
        ('Deity', '{"adjust":{"add":{"s-f":["Deity.pantheon","Deity.alignment"]}}}'::jsonb),
        ('Item', '{"adjust":{"add":{"s-f":["Item.itemType","Item.rarity","Item.attunement"]}}}'::jsonb),
        ('Weapon', '{"adjust":{"add":{"s-f":["Weapon.category","Weapon.damage","Weapon.damageType"]}}}'::jsonb),
        ('Armor', '{"adjust":{"add":{"s-f":["Armor.armorType","Armor.ac"]}}}'::jsonb),
        ('Party', '{"adjust":{"add":{"s-f":["Party.level","Party.motto"]}}}'::jsonb),
        ('Story', '{"adjust":{"add":{"s-f":["Story.kind","Story.played"]}}}'::jsonb),
        ('Arc', '{"adjust":{"add":{"s-f":["Arc.levelFrom","Arc.levelTo"]}}}'::jsonb),
        ('Scene', '{"adjust":{"add":{"s-f":["Scene.mode","Difficulty"]}}}'::jsonb),
        ('Quest', '{"adjust":{"add":{"s-f":["Quest.progress","Quest.reward"]}}}'::jsonb),
        ('Map', '{"adjust":{"add":{"s-f":["Map.kind"]}}}'::jsonb),
        ('Recipe', '{"adjust":{"add":{"s-f":["Recipe.trade","Recipe.time"]}}}'::jsonb),
        ('Encounter', '{"adjust":{"add":{"s-f":["Encounter.kind","Encounter.phase","Difficulty"]}}}'::jsonb),
        ('Event', '{"adjust":{"add":{"s-f":["Event.kind","Time.display"]}}}'::jsonb)
  ) as v(art, alt)
 where i.name = v.art
   and i.views -> 'search' = v.alt;

delete from view_def
 where key = 'search'
   and config = '{"label":"Search","order":6,"fields":"none","description":true,"composed":false,"relations":false,"bindings":false,"image":true,"layout":[{"id":"s-img","el":"image"},{"id":"s-desc","el":"description"},{"id":"s-f","el":"fields","fields":[]}]}'::jsonb;

update view_def
   set config = jsonb_set(config, '{group}', '"quick"')
 where config ->> 'group' = 'search';

update relation
   set props = jsonb_set(props, '{view}', '"quick"')
 where type = 'placed'
   and props->>'view' = 'search'
   and not exists (select 1 from view_def where key = 'search');

-- Kanten erklären (T-111, REQ-257): je Kantenart, was sie bedeutet
-- (`means`) und — wo sie eine Wirkung verspricht, die noch kein Auswerter
-- liest — was sie bewirken soll (`intended`). Was sie heute bewirkt, steht
-- in keiner Spalte: das rechnet `edgeEffects` aus dem Verzeichnis der
-- Auswerter (packages/model/src/edges.ts), das ein Test gegen den Code hält.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Sätze hier
-- nach — nur, wo die Kantenart steht und noch keinen Satz hat. Entfernt wird
-- nichts.

alter table relation_def add column if not exists means text;
alter table relation_def add column if not exists intended text;

update relation_def r
   set means = coalesce(r.means, v.means),
       intended = coalesce(r.intended, v.intended)
  from (values
  ('composedOf', 'A statblock is built from a pooled rule (an attack, a trait); the rule lists the statblocks that use it.', null),
  ('belongsTo', 'A statblock belongs to one creature; the creature reads its numbers from it.', null),
  ('stageOf', 'A condition is a stage of another (exhaustion 3 of exhaustion); the base condition lists its stages.', null),
  ('affects', 'A rule changes another rule (a feat that alters grappling); the changed rule lists what affects it.', 'Apply the change in play: when the source rule is active, the effect it names should alter the target rule’s numbers or text where the target is used.'),
  ('worships', 'A creature or faction worships a deity; the deity lists its worshippers.', null),
  ('casts', 'A statblock, character, item, subclass or ancestry can cast a spell; the spell lists who casts it.', 'Feed the spell list and its uses: mode, uses, level and charges should appear on the sheet as castable, with slots and charges counted down in play.'),
  ('equips', 'A statblock has an item equipped; the item lists who wears or wields it.', 'Count equipped items: armour and shields should set AC, weapons should become attacks on the statblock.'),
  ('subclassOf', 'A subclass belongs to one class; the class lists its subclasses.', null),
  ('subraceOf', 'An ancestry is a subrace of another; the parent lists its subraces.', 'Inherit from the parent: a subrace should bring what its parent ancestry grants, and the builder should offer it under the parent.'),
  ('hasClass', 'A player character has levels in a class; the class lists who took it.', null),
  ('hasAncestry', 'A player character has one ancestry; the ancestry lists the characters of it.', null),
  ('hasBackground', 'A player character has one background; the background lists the characters with it.', null),
  ('allowsMethod', 'A campaign allows a way of determining ability scores; the method lists the campaigns that allow it.', null),
  ('allowsEquipment', 'A campaign allows a way of getting starting equipment; the method lists the campaigns that allow it.', null),
  ('abilityPool', 'A party has rolled a pool of ability scores with a method; the method lists the parties that rolled with it.', null),
  ('chose', 'A player character answered a choice (a skill, a feat, a subclass); the source of the choice lists who chose from it.', null),
  ('grants', 'A class, subclass, ancestry, background or feat grants a feature, from a level on; the feature lists what grants it.', null),
  ('hasProperty', 'A weapon, armour or item has a property (finesse, heavy); the property lists the items that have it.', 'Use the property in numbers: finesse should let an attack use DEX, heavy and two-handed should show on the attack.'),
  ('owes', 'A creature owes another something (a favour, a debt); the creditor lists who owes it.', null),
  ('memberOf', 'A creature is a member of a faction, at a rank; the faction lists its members.', null),
  ('livesIn', 'A creature lives in a place; the place lists its residents.', null),
  ('partOf', 'An article is part of a larger one (a room of a house, a scene of an arc, a book of a group); the larger one lists what it contains, in rank order.', null),
  ('chapterOf', 'A chapter is read as a chapter of a story (the arc of an adventure); the story lists the chapters that read it.', null),
  ('controls', 'A faction controls a place; the place lists who controls it.', null),
  ('describedIn', 'An article is described in another article; that one lists what it describes.', null),
  ('memberOfParty', 'A creature is in a party; the party lists its members.', null),
  ('partyOf', 'A party plays in one campaign; the campaign lists its parties.', null),
  ('carries', 'A creature, party or item carries one inventory; the inventory knows who carries it.', null),
  ('holds', 'An inventory holds an item, with quantity and place in the grid; the item lists where it is held.', null),
  ('questGiver', 'A quest is given by a creature or faction; they list the quests they give.', null),
  ('questAbout', 'A quest concerns an article; the article lists the quests about it.', null),
  ('happensAt', 'A story happens at a place; the place lists the scenes there.', null),
  ('features', 'A story features a creature, statblock or faction; they list the stories they appear in.', null),
  ('knowledge', 'An article has a piece of information about it; the information says what it is about.', null),
  ('knownBy', 'Information or knowledge is known by a creature, party or faction (from a rank); they list what they know.', null),
  ('includes', 'A bundle of knowledge includes a piece of information; the information lists the bundles it is part of.', null),
  ('mapOf', 'A map shows a place or story; the place lists its maps.', null),
  ('insideMap', 'A map lies inside another map, at a rectangle; the outer map lists what you can zoom into.', 'Zoom on the map screen: clicking the rectangle on the outer map should open the inner one.'),
  ('marker', 'A map has a marker for an article, at a point; the article lists the maps it is marked on.', 'Draw on the map screen: the marker should stand at its point, with light and stealth used for what players see.'),
  ('zone', 'A map has a zone of a kind (difficult terrain, darkness); the zone kind lists where it lies.', 'Draw on the map screen and count it: a zone should change movement and sight where it lies.'),
  ('territory', 'A map shows an article’s territory as a shape; the article lists where it holds ground.', 'Draw on the map screen: the shape in its colour over the map.'),
  ('needs', 'A recipe needs an item, in a quantity; the item lists the recipes that use it.', 'Check at the workbench: crafting should require and, where consumed, use up the needed items from the crafter’s inventory.'),
  ('yields', 'A recipe yields one item; the item lists the recipe that makes it.', 'Deliver at the workbench: a finished crafting should put the item into the crafter’s inventory.'),
  ('placed', 'A board has an article placed on it as a card; the article lists the boards it lies on.', null),
  ('participates', 'An encounter has a creature, statblock or party in the fight, with initiative and hit points; they list the fights they are in.', null),
  ('onMap', 'An encounter or story is fought on a map; the map lists what is fought there.', 'Open the map in play: starting the encounter should show this map on the map screen.'),
  ('loot', 'An encounter, story or quest has loot (an item, information, a feat), with quantity and chance; the loot lists where it is found.', 'Roll and hand out: finishing the encounter should roll the chance and offer the loot to the party’s inventory or knowledge.'),
  ('involves', 'An event involves an article; the article lists the events it took part in.', null),
  ('entry', 'A table has an entry, with a weight; the entry lists the tables it can be rolled on.', 'Roll on the table: the weights should decide which entry a roll lands on.'),
  ('tableFor', 'A place, story, encounter or character option rolls on a table; the table lists where it is used.', null),
  ('route', 'A place leads to another, with travel hours and terrain; the other lists where it is reached from.', 'Travel: moving the party along a route should advance the watch and day counters by its hours.'),
  ('inLayer', 'An article comes from a layer (a book, the campaign, homebrew); the layer lists what it brings.', null),
  ('inWorld', 'A campaign plays in one world; the world lists its campaigns.', 'Share the world: the campaign should read its calendar and history from this world.'),
  ('activates', 'A campaign puts a layer in play, in an order and mode; the layer lists the campaigns it is in play in.', null),
  ('instanceOf', 'A statblock or item is an instance of a template and stores only what differs; the template lists its instances.', null),
  ('variantOf', 'An article is a variant of another (an adopted or adapted copy); the original lists its variants.', null),
  ('overrides', 'A version replaces another article wherever its layer is in play; the replaced one lists what replaces it.', null),
  ('crafting', 'A creature or party is working on a recipe, with days and rolls so far; the recipe lists who works on it.', null),
  ('regards', 'A creature, party or faction regards another, in words (trusts, fears); the other lists who judges it — the reverse is its own edge.', null)
  ) as v(type, means, intended)
 where r.type = v.type;

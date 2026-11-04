-- Icons im Register (T-461, REQ-460, E-210 a).
--
-- 1. `interface_def.icon`: das Icon einer Art — ein Name aus dem Katalog
--    (`packages/model/src/icons.ts`), die `extends`-Kette hoch geerbt wie
--    `area`. Dieselben Vorgaben wie in `packages/registry`, nur wo die
--    Art noch keines trägt.
-- 2. `Identity.icon`: das eigene Icon eines Artikels (`format: 'icon'`,
--    der Wähler), schlägt das der Art. Nur, wo das Feld noch fehlt.
-- 3. Ein Feld darf `icon` in seinem Schema tragen (`PropertySchema.icon`);
--    das braucht keine Spalte — es steht im JSON des Feldes.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nichts wird entfernt, kein Artikel geändert.
-- Nummer beim Hereinmergen nachgesehen: 167.

alter table interface_def add column if not exists icon text;

with vorgabe(name, icon) as (
  values
    ('Creature', 'user'), ('Place', 'map-pin'), ('Faction', 'flag'), ('Article', 'sticky-note'),
    ('Rule', 'book'), ('Skill', 'target'), ('Language', 'languages'), ('Class', 'graduation-cap'),
    ('Ancestry', 'dna'), ('Background', 'id-card'), ('Spell', 'sparkles'), ('Deity', 'star'),
    ('Statblock', 'heart'), ('Item', 'box'), ('Weapon', 'sword'), ('Armor', 'shield'),
    ('Party', 'users'), ('Inventory', 'backpack'), ('Story', 'book-open'), ('Chapter', 'book-open'),
    ('World', 'globe'), ('Campaign', 'compass'), ('Session', 'calendar'), ('Scene', 'clapperboard'),
    ('Quest', 'scroll-text'), ('Information', 'lock'), ('Knowledge', 'brain'), ('Asset', 'image'),
    ('Map', 'map'), ('Recipe', 'flask-conical'), ('Trade', 'hammer'), ('Collection', 'tags'),
    ('Note', 'sticky-note'), ('GlossaryTerm', 'book'), ('Board', 'layout-grid'), ('Encounter', 'swords'),
    ('Event', 'calendar'), ('Layer', 'layers'), ('Table', 'layout-grid'), ('Feat', 'star'),
    ('Condition', 'heart'), ('Hazard', 'target')
)
update interface_def d
   set icon = v.icon
  from vorgabe v
 where d.name = v.name
   and d.icon is null;

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,icon}',
         '{"type":"string","title":"Icon","format":"icon","description":"A symbol from the icon set, shown before the name in lists, cards and the title. Empty: the icon of its type."}'::jsonb
       )::json
 where name = 'Identity'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'icon');

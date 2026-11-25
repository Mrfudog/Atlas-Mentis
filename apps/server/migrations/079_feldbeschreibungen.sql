-- Feldbeschreibungen und `prominent` (T-195): die Bearbeiten-Maske zeigt
-- Pflichtfelder und Felder mit Wert, die übrigen holt man über „+ Add
-- field“ — mit einem Satz, was das Feld meint. Die geteilten Felder, die
-- jede Art mitnimmt, bekommen hier ihre Beschreibung; `Description` und
-- `Status` stehen auch leer da (`prominent`).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Geändert wird nur das Register, und nur Felder, die es gibt; eine
-- Angabe, die schon dasteht, bleibt.
--
-- Nichts fällt weg.

with neu(art, feld, angabe) as (
  values
    ('Identity',    'aliases',     '{"description":"Other names this is known by; search and links find it under each."}'),
    ('Identity',    'cover',       '{"description":"The name players see while the real name is a secret they have not learned."}'),
    ('Description', 'description', '{"prominent":true,"description":"What this is, in a few sentences."}'),
    ('Tags',        'tags',        '{"description":"Free labels to group and filter articles by."}'),
    ('Status',      'status',      '{"prominent":true,"description":"How far the preparation is: idea, prepared or ready. Players see only what is ready."}'),
    ('Visibility',  'audience',    '{"description":"Who may see this at all: everyone, the campaign, its players or the GM."}'),
    ('Visibility',  'revealedTo',  '{"description":"Characters, parties or factions that see this even where the audience would not let them."}'),
    ('Visibility',  'hiddenFrom',  '{"description":"Characters, parties or factions that never see this, whatever else says so."}'),
    ('Image',       'image',       '{"description":"A picture shown on the article and its card."}'),
    ('Image',       'caption',     '{"description":"A line under the picture."}'),
    ('Image',       'alt',         '{"description":"Describes the picture for screen readers and when it does not load."}'),
    ('Vars',        'bindings',    '{"description":"Values for the {VAR} placeholders in this article’s texts."}'),
    ('Source',      'publication', '{"description":"The book or source this comes from."}'),
    ('Source',      'page',        '{"description":"The page in that publication."}'),
    ('Source',      'anchor',      '{"description":"A section of the source, to link to."}'),
    ('Source',      'url',         '{"description":"A web address for the source."}'),
    ('Source',      'srd',         '{"description":"Part of the freely licensed System Reference Document."}')
)
-- Je Art einmal: ein `update … from` mit mehreren Treffern je Zeile
-- nähme nur einen davon.
, je_art as (
  select d.name,
         jsonb_object_agg(
           n.feld,
           -- was schon dasteht, gewinnt: die Angabe kommt nur dazu
           n.angabe::jsonb || (d.schema::jsonb -> 'properties' -> n.feld)
         ) as felder
    from interface_def d
    join neu n on n.art = d.name
   where (d.schema::jsonb -> 'properties') ? n.feld
   group by d.name
)
update interface_def d
   set schema = jsonb_set(
         d.schema::jsonb,
         '{properties}',
         (d.schema::jsonb -> 'properties') || j.felder
       )::json
  from je_art j
 where d.name = j.name;

-- Inventar im Web (T-127): `Campaign.inventory` und `holds.props.reservedFor`
-- auf bestehenden Datenbanken nachziehen (wie 042, 059).
--
--  1. `Campaign.inventory` — wie diese Kampagne Inventar zählt (Raster,
--     Gewicht, Slots); ohne Angabe das Raster. Wandert mit T-132 in ein Modul.
--  2. `holds.props.reservedFor` — ein Stapel ist für einen Artikel
--     reserviert (Schnittstelle für den Handwerksauftrag T-128).
--
-- Ergänzt wird nur, was fehlt; kein Artikel wird geändert.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,inventory}',
     '{"type":"string","title":"Inventory rules","enum":["grid","weight","slots"],"default":"grid"}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'inventory';

update relation_def
   set props = jsonb_set(
     props,
     '{properties,reservedFor}',
     '{"type":"string","format":"link","target":{"interfaces":["Identity"]},"title":"Reserved for"}'::jsonb
   )
 where type = 'holds'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties') ? 'reservedFor';

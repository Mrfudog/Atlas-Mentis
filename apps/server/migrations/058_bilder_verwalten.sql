-- Bilder verwalten (T-119): die Klasse eines Bildes und wo sie angeboten wird.
--
-- 1. `interface_def.targets`: ein Typ darf das Ziel eines geerbten Feldes
--    einengen (`Typ.feld` → Ziel), wie `titles` die Beschriftung. Die
--    Karte bietet bei `Image.image` Kartenbilder an, jeder andere Artikel
--    allgemeine Bilder — derselbe Bestandteil, ein anderer Vorschlag.
-- 2. Die Startzeilen auf bestehenden Datenbanken nachziehen (wie 055–057;
--    der Seed schreibt Arten nur in eine leere Datenbank):
--    - `Asset.kind` (Klasse: image, map, token, prop), Vorgabe `image`;
--    - die Liste der Assets zeigt Bild und Klasse (`overview`) — nur, wo
--      die Art für `overview` noch nichts sagt;
--    - `Image.image` schlägt allgemeine Bilder vor, `Statblock.token`
--      Tokens, `Map` (über `targets`) Kartenbilder — nur, wo das Feld
--      noch kein Ziel nennt.
--
-- Ergänzt wird nur, was fehlt. Entfernt wird nichts, kein Artikel wird
-- geändert: ein Asset ohne `kind` gilt als `image` (`assetKind`).

alter table interface_def add column if not exists targets jsonb;

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,kind}',
     '{"type":"string","title":"Class","enum":["image","map","token","prop"],"default":"image"}'::jsonb
   )
 where name = 'Asset'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'kind';

update interface_def
   set views = jsonb_set(
     coalesce(views, '{}'::jsonb),
     '{overview}',
     '[{"id":"as-ov-img","el":"image"},{"id":"as-ov","el":"fields","fields":["Asset.kind"]}]'::jsonb
   )
 where name = 'Asset'
   and not coalesce(views, '{}'::jsonb) ? 'overview';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,image,target}',
     '{"where":{"component":"Asset","property":"kind","value":"image"}}'::jsonb
   )
 where name = 'Image'
   and jsonb_typeof(schema::jsonb #> '{properties,image}') = 'object'
   and not (schema::jsonb #> '{properties,image}') ? 'target';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,token,target}',
     '{"where":{"component":"Asset","property":"kind","value":"token"}}'::jsonb
   )
 where name = 'Statblock'
   and jsonb_typeof(schema::jsonb #> '{properties,token}') = 'object'
   and not (schema::jsonb #> '{properties,token}') ? 'target';

update interface_def
   set targets = '{"Image.image":{"where":{"component":"Asset","property":"kind","value":"map"}}}'::jsonb
 where name = 'Map'
   and targets is null;

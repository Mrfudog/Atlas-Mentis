-- Kartenverknüpfung als Form, Zoomtiefe und Anzeige je Verknüpfung (T-327).
--
-- An der Kante `insideMap`: `area` (Vieleck in Anteilen der Karte darüber;
-- ohne es ist der Bereich das Rechteck wie bisher), `near` (Zoomtiefe,
-- Vorgabe 0,55), `show` und `showPlayers` (Anzeige für Leitung und
-- Spielende), `outer` (die Karte darüber blass als Rand der Unterkarte).
-- `Campaign.mapLinkShow`, `mapLinkShowPlayers`, `mapLinkOuter`: die Vorgabe
-- der Kampagne. Ohne Angabe gilt, was vor T-327 galt — Rahmen mit Klick,
-- kein Rand.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo die Felder noch fehlen; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         (schema::jsonb -> 'properties')
           || jsonb_build_object(
                'mapLinkShow', '{"type":"string","title":"Sub-map links: shown to the GM","description":"How a linked sub-map appears on the map above for the GM: a frame you click to jump in, only the frame, an icon, or nothing (zoom in to enter).","enum":["jump","frame","icon","hidden"],"default":"jump"}'::jsonb,
                'mapLinkShowPlayers', '{"type":"string","title":"Sub-map links: shown to players","description":"How a linked sub-map appears on the map above for players: a frame you click to jump in, only the frame, an icon, or nothing (zoom in to enter).","enum":["jump","frame","icon","hidden"],"default":"jump"}'::jsonb,
                'mapLinkOuter', '{"type":"string","title":"Sub-map links: map above as border","description":"Whether a sub-map shows the map above, faded, around its own image — as far as the map above is released and revealed.","enum":["faded","none"],"default":"none"}'::jsonb
              )
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'mapLinkShow');

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object(
                'area', '{"type":"array","title":"Link area","items":{"type":"array"}}'::jsonb,
                'near', '{"type":"number","title":"Enter at share of view","min":0.1,"max":1}'::jsonb,
                'show', '{"type":"string","title":"Shown to the GM","enum":["jump","frame","icon","hidden"]}'::jsonb,
                'showPlayers', '{"type":"string","title":"Shown to players","enum":["jump","frame","icon","hidden"]}'::jsonb,
                'outer', '{"type":"string","title":"Map above as border","enum":["faded","none"]}'::jsonb
              )
       ),
       means = 'A map lies inside another map, at a rectangle or a shape; the outer map lists what you can zoom into.'
 where type = 'insideMap'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'near');

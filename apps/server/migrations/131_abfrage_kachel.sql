-- Die Abfrage-Kachel auf dem Board (T-340).
--
-- An der Kante `placed`: `title`, `query` (die Quelle: Arten, Artikel,
-- Marken, Ebenen, Filterkette), `display` (Liste, Ziehen, Slideshow),
-- `drawn` (was gezogen ist — nur die Routen schreiben es), `interval`,
-- `reveal` und `party` (beim Ziehen freigeben). Eine Abfrage-Kachel ist
-- eine Kante des Boards auf sich selbst.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Nummer beim Hereinmergen nachgesehen: 131.

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object(
                'title', '{"type":"string","title":"Title","description":"Query card: the name in its title bar, e.g. Rumours."}'::jsonb,
                'query', '{"type":"object","title":"Query","description":"Query card (T-340): where its articles come from — types, single articles, tags, layers and a filter chain. Answered on the server for each viewer."}'::jsonb,
                'display', '{"type":"string","title":"Shows as","enum":["list","draw","slideshow"],"default":"list","description":"Query card: a list, a random draw without replacement, or a slideshow."}'::jsonb,
                'drawn', '{"type":"array","items":{"type":"string"},"title":"Drawn","readOnly":true,"description":"Query card: what has been drawn, in order. Changed only by Draw and Reset on the server."}'::jsonb,
                'interval', '{"type":"number","title":"Seconds per slide","default":8,"min":2,"max":600}'::jsonb,
                'reveal', '{"type":"boolean","title":"Reveal when drawn","description":"Query card: what is drawn becomes knowledge of the party (knownBy) and visible to it."}'::jsonb,
                'party', '{"type":"string","format":"link","title":"Reveal to","target":{"interfaces":["Party"]},"description":"Query card: the party that learns what is drawn. Empty: the first party of the running campaign."}'::jsonb
              )
       )
 where type = 'placed'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'query');

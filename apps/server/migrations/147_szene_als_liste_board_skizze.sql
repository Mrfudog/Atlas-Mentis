-- Zwei Vorgaben aus T-425, Schnitt 4 — dieselben Zeilen wie in
-- `packages/registry/src/interfaces.ts`:
--
-- * Die Szene zeigt das geerbte „Contains" (`st-contains`, Migration 145)
--   als Liste statt als Kacheln: eine Szene hat oft viele kleine
--   Begegnungen, ein Arc wenige Szenen. Eine Anpassung, die dasselbe
--   Element mit derselben Id an Ort und Stelle anders einstellt.
-- * Die Kurzansicht eines Boards zeigt die Tafel klein (`bq-board`): wo
--   die Kacheln liegen und wie sie heissen. Was für Spielende verborgen
--   ist, nimmt der Server weiter vorher weg.
--
-- Nur, wo die Art für diese Ansicht noch nichts Eigenes sagt. Kein Artikel
-- wird geändert, keine Kante fällt weg.

update interface_def
   set views = coalesce(views, '{}'::jsonb) || jsonb_build_object(
         'full',
         '{"adjust":{"extra":[{"id":"st-contains","el":"collection","text":"Contains","path":[{"relation":"partOf","dir":"in"}],"types":["Story","Encounter"],"unranked":true,"show":"list","groupBy":"type","pos":65}]}}'::jsonb)
 where name = 'Scene'
   and (views is null or views -> 'full' is null);

update interface_def
   set views = coalesce(views, '{}'::jsonb) || jsonb_build_object('quick', '{"adjust":{"extra":[{"id":"bq-board","el":"board","pos":35}]}}'::jsonb)
 where name = 'Board'
   and (views is null or views -> 'quick' is null);

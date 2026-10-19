-- Die Seite eines Wissens (T-287, REQ-353): die Art `Knowledge` zeigt in
-- `full` das Element `knowledgeContents` — was das Wissen vereint, ausgeschrieben.
-- Nur, wo `Knowledge` noch keine eigene `full`-Anordnung hat; was jemand
-- im Register umgebaut hat, bleibt. Nichts fällt weg.

update interface_def
   set views = coalesce(views, '{}'::jsonb) || '{"full":{"adjust":{"extra":[{"id":"kn-contents","el":"knowledgeContents"}]}}}'::jsonb
 where name = 'Knowledge'
   and not coalesce(views, '{}'::jsonb) ? 'full';

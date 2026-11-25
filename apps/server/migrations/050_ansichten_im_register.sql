-- Ansichten im Register (T-110, REQ-256, E-030 b).
--
-- Zwei Dinge, und keins ändert, was heute gezeichnet wird:
--
-- 1. **`full` sagt jetzt selbst, dass Ungenanntes am Ende steht**
--    (`rest: true`). Die Artikelseite tat das immer, ohne dass es irgendwo
--    stand; jetzt ist es eine Einstellung der Ansicht, und die Karte sagt
--    das Gegenteil, indem sie es nicht sagt. Gesetzt nur, wo `rest` noch
--    fehlt — wer es schon gesetzt hat, behält seine Wahl.
--
-- 2. **Die Ansicht `print`** für „Print" an der Artikelseite — nur, wenn es
--    sie noch nicht gibt. Dieselbe Zeile wie im Seed (`packages/registry`).
--
-- Die Anordnungen an den Arten (`interface_def.views`) bleiben, wie sie
-- sind: eine Liste ist weiter „eine eigene Anordnung", und die neue Form
-- `{ "adjust": … }` kommt erst, wenn jemand sie im Register wählt.
-- Entfernt wird nichts.

update view_def
   set config = config || '{"rest": true}'::jsonb
 where key = 'full'
   and not (config ? 'rest');

insert into view_def (key, label, ord, config)
values (
  'print',
  'Print',
  4,
  '{"label":"Print","order":4,"fields":"all","description":true,"composed":true,"relations":false,"bindings":true,"image":false,"rest":true,"layout":[{"id":"p-desc","el":"description"},{"id":"p-f","el":"fields","fields":"all"},{"id":"p-b","el":"prose","fields":"all"},{"id":"p-parts","el":"parts"},{"id":"p-c","el":"composed"}]}'::jsonb
)
on conflict (key) do nothing;

-- Das Glossar (T-242): Begriffe als Artikel.
--
--  1. Art `GlossaryTerm` (erbt von `Rule`, Bereich rules): Sorte, „How it
--     affects play", Beispiele, Übersetzungen; die Definition ist
--     `Description.description` und heisst an der Art „Definition".
--  2. Kante `explains` vom Begriff auf den Artikel, den er erklärt (den
--     Zustand, die Eigenschaft, die Regel).
--
-- Die Wörter der App stehen nicht hier, sondern im Code
-- (`packages/registry/src/glossar.ts`); Spielbegriffe kommen als Artikel
-- über die API in die Ebene ihres Regelwerks.
--
-- Wie 090 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert.

insert into interface_def (name, label, abstract, extends, schema, area, views, titles)
select 'GlossaryTerm', 'Glossary term', false, array['Rule'],
       '{"type":"object","properties":{"sort":{"type":"string","title":"Sort","enum":["app","rule","condition","property","action","other"],"default":"rule","description":"What kind of term this is: app (a word of Atlas Mentis itself), rule, condition, property (of a weapon or item), action (a kind of action), other. The handbook filters by it."},"effect":{"type":"string","format":"long","title":"How it affects play","description":"What changes at the table when this applies — in a sentence or two."},"example":{"type":"string","format":"long","many":true,"title":"Examples","description":"A short situation that shows the term at work."},"translations":{"type":"array","many":true,"title":"Translations","description":"The term in other languages: the word, and a definition if it differs.","items":{"type":"object"},"entry":{"type":"object","required":["id","lang","term"],"properties":{"id":{"type":"string","title":"Id"},"lang":{"type":"string","title":"Language","description":"A language code such as de or fr."},"term":{"type":"string","title":"Term"},"definition":{"type":"string","format":"long","title":"Definition"}}}}}}'::json,
       'rules',
       '{"overview":[{"id":"glo-ov","el":"fields","fields":["GlossaryTerm.sort","Description.description"]}]}'::jsonb,
       '{"Description.description":"Definition"}'::jsonb
where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'explains', 'explains', 'explained by', '{GlossaryTerm}'::text[], '{*}'::text[], false, 'many', '{}'::jsonb,
       'A glossary term explains an article (a condition, a property, a rule); the article lists the terms that explain it.'
where exists (select 1 from relation_def)
on conflict (type) do nothing;

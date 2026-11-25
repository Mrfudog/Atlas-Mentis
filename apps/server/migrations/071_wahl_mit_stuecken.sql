-- T-162: Die Antwort auf eine Ausrüstungswahl füllt ihre offenen Stellen.
--
-- „two martial weapons of your choice" ist eine Möglichkeit, die keinen
-- Gegenstand nennt, sondern eine Sorte. Welche Waffen die Figur nimmt,
-- steht an ihrer Antwort: `chose.props.items`, Artikel-Ids der Reihe nach
-- (`packages/model/src/slots.ts`). Hier kommt die Angabe ins Register —
-- nur, wo schon eines steht (wie 042). Entfernt wird nichts.
update relation_def
   set props = jsonb_set(
     props,
     '{properties}',
     (props -> 'properties')
       || '{"items":{"type":"array","items":{"type":"string"},"title":"Items for open slots"}}'::jsonb
   )
 where type = 'chose'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties' ? 'items');

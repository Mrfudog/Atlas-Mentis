-- Talente wirken ihre Zauber (T-089): `casts` nimmt `Feat` als Wirkenden,
-- wie die Abstammung. Drow High Magic wirkt Levitate einmal am Tag; mit
-- `grants` ginge das „1/day" verloren. Der Importer legt die Kanten seit
-- PR #97 an; der Seed schreibt nur in eine leere Datenbank, also kommt die
-- Quellart hier nach — nur, wo `casts` steht und `Feat` noch fehlt.
-- Entfernt wird nichts.

update relation_def
   set from_ifaces = from_ifaces || array['Feat']
 where type = 'casts' and not ('Feat' = any(from_ifaces));

update relation_def
   set means = 'A statblock, character, item, subclass, ancestry or feat can cast a spell; the spell lists who casts it.'
 where type = 'casts'
   and means = 'A statblock, character, item, subclass or ancestry can cast a spell; the spell lists who casts it.';

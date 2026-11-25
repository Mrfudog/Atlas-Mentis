-- Orte aus Büchern und Abenteuern (T-175).
--
-- Der Importer legt zu jedem Abschnitt, der einen Ort beschreibt, einen
-- `Place` an. Dafür zwei Registeränderungen:
--
--  1. `Place` nimmt `Source` dazu: ein Ort aus einem Buch nennt Quelle und
--     Seite wie jeder andere eingelesene Artikel.
--  2. `describedIn` darf auch auf einen Abschnitt eines Buchs (`BookPart`)
--     und eine Szene (`Story`) zeigen — der Ort verweist auf den Text, der
--     ihn beschreibt, und die Leseansicht zeigt ihn dort.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt das Register
-- hier nach, nur wo schon eines steht. Entfernt wird nichts.

update interface_def
   set extends = extends || array['Source']
 where name = 'Place' and not ('Source' = any(extends));

update relation_def
   set to_ifaces = array['Article', 'Story', 'BookPart'],
       means = 'An article is described in another article or a section of a book; that one lists what it describes.'
 where type = 'describedIn';

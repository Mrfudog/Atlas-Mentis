-- Abenteuerkapitel als Chapter und Arc, ihr Text als Teile (T-108, E-028, E-029).
--
-- Seit T-108 legt der Importer je Kapitel eines Abenteuers zweimal
-- dasselbe an: einen `Arc` (die Geschichte, E-026) und ein `Chapter` (die
-- Lesestruktur, `<Arc>_chapter`, `chapterOf` der Arc), und der Text wird
-- zu Teil-Artikeln mit Rang. Hier bekommen die schon geladenen Abenteuer
-- dasselbe, ohne Neueinlesen und ohne dass ein Artikel geht:
--
--  1. je importiertem Arc (Peg-Id `e5_…` — Arcs und Szenen legt der
--     Importer nur für Abenteuer an, auch für eines in einem Quellenbuch
--     wie MOT) sein Chapter mit derselben Id wie beim Import — ein
--     späteres `--only-new` legt keines zweimal an;
--  2. die Szenen auf Kapitelstufe (`partOf` der Arc) stehen mit Rang im
--     Chapter, ein Raum bekommt den Rang an seiner Kante zur Szene; die
--     Reihenfolge ist die Nummer, wie der Importer sie in Buchreihenfolge
--     vergab;
--  3. **der Text zieht um, er geht nicht:** je Vorlesetext eines Arcs oder
--     einer Szene ein `ReadAloudText` (`<Artikel>_read<n>`), der übrige Text
--     als ein `Paragraph` (`<Artikel>_text`), mit Rang im Chapter
--     beziehungsweise in der Szene, vor deren Räumen. Arc und Szene tragen
--     danach keine Karten `Prose` und `ReadAloud` mehr. Feiner zerlegt (je
--     Absatz ein Teil, Vorlesetexte an ihrer Stelle im Text) wird ein
--     Abenteuer, das neu geladen wird; `--only-new` legt in einem schon
--     stehenden Kapitel keine Teile dazu (Teile kommen nur mit ihrem Ganzen).
--
-- Fassungen der Leitung (`overrides`, E-018) bleiben, wie sie sind; wie
-- viele davon eigenen Text tragen, sagt das Startprotokoll.
--
-- Die Prüfabfrage zählt Vorlesetexte, die nicht als Liste vorliegen und
-- darum beim Umzug verloren gingen — so geschrieben 0.
--
-- verlust: select count(*) from component c join component m on m.entity_id = c.entity_id and m.type = '__meta' and m.payload->'interfaces'->>0 in ('Arc', 'Scene') where c.type = 'ReadAloud' and c.entity_id like 'e5\_%' and jsonb_typeof(c.payload->'readaloud') <> 'array'

-- 0. Was importiert ist ------------------------------------------------------

create temp table t108_quelle (id text primary key, art text, ebene text) on commit drop;
insert into t108_quelle
select distinct on (m.entity_id) m.entity_id, m.payload->'interfaces'->>0, l.to_id
  from component m
  join relation l on l.from_id = m.entity_id and l.type = 'inLayer'
 where m.type = '__meta'
   and m.payload->'interfaces'->>0 in ('Arc', 'Scene')
   and m.entity_id like 'e5\_%'
 order by m.entity_id, l.id;

-- 1. Je Arc sein Chapter ----------------------------------------------------

create temp table t108_kapitel (arc text primary key, kapitel text, ebene text, name text, n int) on commit drop;
insert into t108_kapitel
select q.id, q.id || '_chapter', q.ebene, coalesce(i.payload->>'name', ''),
       row_number() over (order by substring(i.payload->>'id' from '(\d+)$')::int nulls last, q.id)::int
  from t108_quelle q
  left join component i on i.entity_id = q.id and i.type = 'Identity'
 where q.art = 'Arc'
   and not exists (select 1 from entity e where e.id = q.id || '_chapter');

-- Die Nummern zählen hinter den höchsten vorhandenen weiter (`nextId`).
create temp table t108_basis on commit drop as
select coalesce(max(substring(payload->>'id' from '^chapter-(\d+)$')::int) filter (where payload->>'id' ~ '^chapter-\d+$'), 0) as kapitel,
       coalesce(max(substring(payload->>'id' from '^paragraph-(\d+)$')::int) filter (where payload->>'id' ~ '^paragraph-\d+$'), 0) as absatz,
       coalesce(max(substring(payload->>'id' from '^readaloudtext-(\d+)$')::int) filter (where payload->>'id' ~ '^readaloudtext-\d+$'), 0) as vorlesen
  from component
 where type = 'Identity';

insert into entity (id) select kapitel from t108_kapitel;

insert into component (entity_id, type, payload)
select t.kapitel, '__meta', '{"interfaces":["Chapter"],"adhoc":[]}'::jsonb from t108_kapitel t
union all
select t.kapitel, 'Identity',
       jsonb_build_object('name', t.name, 'id', 'chapter-' || lpad((b.kapitel + t.n)::text, 4, '0'))
  from t108_kapitel t, t108_basis b
union all
select t.kapitel, 'Name', n.payload
  from t108_kapitel t join component n on n.entity_id = t.arc and n.type = 'Name'
union all
select t.kapitel, 'Visibility', v.payload
  from t108_kapitel t join component v on v.entity_id = t.arc and v.type = 'Visibility'
union all
select t.kapitel, 'Notes', o.payload
  from t108_kapitel t join component o on o.entity_id = t.arc and o.type = 'Notes'
union all
select t.kapitel, 'Chapter', jsonb_build_object('ordinal', substring(t.name from '^((?:Chapter|Part|Appendix|Episode|Act) [^:]+):'))
  from t108_kapitel t
 where t.name ~ '^(Chapter|Part|Appendix|Episode|Act) [^:]+:';

insert into relation (id, from_id, to_id, type, props, ord)
select t.kapitel || '~inLayer-1', t.kapitel, t.ebene, 'inLayer', '{}'::jsonb, 0 from t108_kapitel t
union all
select t.kapitel || '~chapterOf-2', t.kapitel, t.arc, 'chapterOf', '{}'::jsonb, 1 from t108_kapitel t;

-- 3. Der Text zieht in Teile um ----------------------------------------------
-- (vor Schritt 2: die Teile stehen vor den Szenen, Rang 1 …, die Szenen ab 1000)

create temp table t108_teil (
  quelle text, teil text, art text, ganzes text, ebene text, rang int, nr int, payload jsonb, name text
) on commit drop;

-- Wohin die Teile eines Arcs gehen: in sein Chapter; die einer Szene: in sie.
create temp table t108_ganzes on commit drop as
select q.id as quelle, coalesce(k.kapitel, q.id || '_chapter') as ganzes, q.ebene
  from t108_quelle q left join t108_kapitel k on k.arc = q.id
 where q.art = 'Arc'
union all
select q.id, q.id, q.ebene from t108_quelle q where q.art = 'Scene';

insert into t108_teil (quelle, teil, art, ganzes, ebene, rang, payload, name)
select g.quelle, g.quelle || '_read' || r.i, 'ReadAloudText', g.ganzes, g.ebene, r.i::int,
       jsonb_build_object('readaloud', jsonb_build_array(jsonb_build_object('id', 'read', 'value', r.wert->>'value'))),
       coalesce(r.wert->>'value', '')
  from t108_ganzes g
  join component c on c.entity_id = g.quelle and c.type = 'ReadAloud' and jsonb_typeof(c.payload->'readaloud') = 'array'
  cross join lateral jsonb_array_elements(c.payload->'readaloud') with ordinality as r(wert, i)
 where exists (select 1 from entity e where e.id = g.ganzes)
   and coalesce(r.wert->>'value', '') <> '';

insert into t108_teil (quelle, teil, art, ganzes, ebene, rang, payload, name)
select g.quelle, g.quelle || '_text', 'Paragraph', g.ganzes, g.ebene,
       (select count(*) from t108_teil t where t.quelle = g.quelle)::int + 1,
       c.payload,
       coalesce(c.payload->'paragraph'->0->>'value', '')
  from t108_ganzes g
  join component c on c.entity_id = g.quelle and c.type = 'Prose'
 where exists (select 1 from entity e where e.id = g.ganzes)
   and jsonb_typeof(c.payload->'paragraph') = 'array'
   and jsonb_array_length(c.payload->'paragraph') > 0;

-- Was es schon gibt (ein zweiter Lauf, ein Import danach), bleibt.
delete from t108_teil t where exists (select 1 from entity e where e.id = t.teil);

update t108_teil t set nr = x.nr
  from (select teil, row_number() over (partition by art order by quelle, rang)::int as nr from t108_teil) x
 where x.teil = t.teil;

-- Ein Name aus den ersten Worten (`partName`), ohne Verweise und Auszeichnung.
update t108_teil set name = regexp_replace(regexp_replace(regexp_replace(regexp_replace(name,
         '\[\[[^\]|]+\|([^\]]+)\]\]', '\1', 'g'), '\[\[([^\]]+)\]\]', '\1', 'g'), '[*_#>|`]', ' ', 'g'), '\s+', ' ', 'g');
update t108_teil set name = btrim(name);
update t108_teil set name = substring(name from 1 for 59) || '…' where length(name) > 60;
update t108_teil set name = art where name = '';

insert into entity (id) select teil from t108_teil;

insert into component (entity_id, type, payload)
select t.teil, '__meta', jsonb_build_object('interfaces', jsonb_build_array(t.art), 'adhoc', '[]'::jsonb) from t108_teil t
union all
select t.teil, 'Identity',
       jsonb_build_object('name', t.name, 'id',
         case t.art when 'Paragraph' then 'paragraph-' || lpad((b.absatz + t.nr)::text, 4, '0')
                    else 'readaloudtext-' || lpad((b.vorlesen + t.nr)::text, 4, '0') end)
  from t108_teil t, t108_basis b
union all
select t.teil, 'Name', jsonb_build_object('text', t.name) from t108_teil t
union all
select t.teil, case t.art when 'Paragraph' then 'Prose' else 'ReadAloud' end, t.payload from t108_teil t
union all
select t.teil, 'Visibility', v.payload
  from t108_teil t join component v on v.entity_id = t.quelle and v.type = 'Visibility';

insert into relation (id, from_id, to_id, type, props, ord)
select t.teil || '~inLayer-1', t.teil, t.ebene, 'inLayer', '{}'::jsonb, 0 from t108_teil t
union all
select t.teil || '~partOf-2', t.teil, t.ganzes, 'partOf', jsonb_build_object('rank', t.rang), 1 from t108_teil t;

-- Umgezogen heisst: an Arc und Szene steht der Text nicht mehr doppelt.
delete from component c
 using (select distinct quelle from t108_teil) t
 where c.entity_id = t.quelle
   and c.type in ('Prose', 'ReadAloud')
   and not exists (
     select 1 from component m where m.entity_id = c.entity_id and m.type = c.type
       and c.type = 'ReadAloud' and jsonb_typeof(m.payload->'readaloud') <> 'array'
   );

-- 2. Szenen mit Rang -------------------------------------------------------

-- Szenen auf Kapitelstufe stehen im Chapter ihres Arcs.
insert into relation (id, from_id, to_id, type, props, ord)
select s.id || '~partOf-chapter', s.id, k.kapitel, 'partOf',
       jsonb_build_object('rank', 1000 + row_number() over (partition by k.kapitel order by substring(i.payload->>'id' from '(\d+)$')::int nulls last, s.id)), 9
  from t108_quelle s
  join relation p on p.from_id = s.id and p.type = 'partOf'
  join t108_kapitel k on k.arc = p.to_id
  left join component i on i.entity_id = s.id and i.type = 'Identity'
 where s.art = 'Scene'
   and not exists (select 1 from relation x where x.id = s.id || '~partOf-chapter');

-- Ein Raum bekommt den Rang an seiner Kante zur Szene.
update relation r
   set props = r.props || jsonb_build_object('rank', x.rang)
  from (
    select p.id, 1000 + row_number() over (partition by p.to_id order by substring(i.payload->>'id' from '(\d+)$')::int nulls last, p.from_id) as rang
      from relation p
      join t108_quelle s on s.id = p.from_id and s.art = 'Scene'
      join t108_quelle z on z.id = p.to_id and z.art = 'Scene'
      left join component i on i.entity_id = p.from_id and i.type = 'Identity'
     where p.type = 'partOf' and not (p.props ? 'rank')
  ) x
 where r.id = x.id;

-- Was geändert ist, ist geschrieben: der Server liest den Bestand neu.
update entity set updated_at = now()
 where id in (select id from t108_quelle) or id in (select kapitel from t108_kapitel);

do $$
declare
  kapitel int := (select count(*) from t108_kapitel);
  teile int := (select count(*) from t108_teil);
  fassungen int := (
    select count(distinct o.from_id)
      from relation o
      join t108_quelle q on q.id = o.to_id
      join component c on c.entity_id = o.from_id and c.type in ('Prose', 'ReadAloud')
     where o.type = 'overrides'
  );
begin
  if kapitel > 0 or teile > 0 then
    raise notice 'Abenteuer: % Kapitel als Chapter angelegt, % Teile aus dem Text von Arcs und Szenen', kapitel, teile;
  end if;
  if fassungen > 0 then
    raise notice 'Fassungen mit eigenem Text an umgezogenen Szenen oder Arcs (bleiben, wie sie sind): %', fassungen;
  end if;
end $$;

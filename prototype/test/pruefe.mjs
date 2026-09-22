/* Prüflauf gegen den Prototyp. `node build-harness.mjs` vorher laufen lassen.
   Der Stub friert die Snapshot-Objekte ein wie die echte Laufzeit — siehe
   README.md; ein grosszügigerer Aufbau prüft nichts. */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));

/* Der Prüfaufbau nimmt den Chromium, der im Bild schon liegt, wenn einer da
   ist. Playwright bringt seine eigene Bauversion mit, und die passt nur zu
   der Playwright-Version, die sie geladen hat — ein Upgrade der Bibliothek
   liesse den Lauf sonst mit „Executable doesn't exist" stehen. */
const AUS_DEM_BILD = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(
  existsSync(AUS_DEM_BILD) ? { executablePath: AUS_DEM_BILD } : {});
let fehler = 0;
const pruefe = (name, ok, was) => {
  if (!ok) fehler++;
  console.log(`${ok ? '  ok  ' : 'FEHLT '} ${name}${ok ? '' : ' — ' + JSON.stringify(was)}`);
};

/** Auf eine der sechs Seiten wechseln. Die Leiste zeigt danach, was darin
 *  steckt — vorher standen alle Bereiche untereinander, und ein Klick in die
 *  Leiste reichte. */
const zurSeite = async (p, name) => {
  await p.evaluate((n) => {
    const b = [...document.querySelectorAll('#pages button')].find((x) => x.textContent === n);
    if (b) b.click();
  }, name);
  await p.waitForTimeout(400);
};

/** Auf einen Teil des Registers. Die Reiter oben sagen, worin man ist; die
 *  Leiste links zeigt danach die Zeilen dieses Teils. */
const zumRegister = async (p, name) => {
  await zurSeite(p, 'Registry');
  await p.evaluate((n) => {
    const b = [...document.querySelectorAll('.tabs button')].find((x) => x.textContent === n);
    if (b) b.click();
  }, name);
  await p.waitForTimeout(350);
};

/** Eine Artikelart in der Leiste wählen — über den Namen und nicht über die
 *  Beschriftung: `StatblockCore` steht dort als „Statblock". */
const zumTyp = async (p, name) => {
  await zumRegister(p, 'Types');
  await p.evaluate((i) => document.querySelector('.rail .navrow[data-t="' + i + '"]').click(), name);
  await p.waitForTimeout(350);
};

async function seite(datei, warten) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = [];
  const modale = [];
  p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  /* Ein Browser-Modal ist hier ein Fehler, kein Ereignis: die Seite läuft im
     Artefakt in einem sandboxed iframe, wo confirm() verworfen wird und false
     liefert. Wer sich darauf verlässt, dessen Knopf tut stillschweigend
     nichts. Darum wird abgewiesen und gezählt, nicht bestätigt. */
  p.on('dialog', (d) => { modale.push(d.message()); d.dismiss(); });
  await p.goto(`file://${join(HIER, 'harness', datei)}`);
  await p.waitForTimeout(warten);
  return { p, errs, modale };
}

/* 1 — mit Daten: die Liste steht, keine Meldung, keine Ausnahme */
{
  const { p, errs, modale } = await seite('index.html', 1200);
  const s = await p.evaluate(() => ({
    rows: document.querySelectorAll('#view .row').length,
    banner: document.querySelector('#view .banner')?.textContent ?? null,
    laedt: document.getElementById('view').innerText.trim() === 'Loading…',
  }));
  pruefe('articles are listed', s.rows > 0, s);
  pruefe('no watchdog banner', s.banner === null, s);
  pruefe('not stuck on Loading…', !s.laedt, s);
  pruefe('no exception', errs.length === 0, errs);

  /* 2 — Register: Baum, Felder, Subtyp anlegen.
     **Oben die Reiter, links die Zeilen.** Der Reiter sagt, in welchem Teil
     des Registers man ist; die Leiste zeigt, was darin steht. Beides in der
     Leiste zu haben und die Zeilen noch einmal in der Seite waren zwei
     Listen für eine Frage, und keine sagte, welche gerade gilt. */
  await zumRegister(p, 'Types');
  const baum = await p.evaluate(() =>
    [...document.querySelectorAll('.rail .navrow')].map((b) => b.textContent));
  pruefe('registry shows the interface tree', baum.length > 3, baum.length);

  await p.evaluate(() =>
    [...document.querySelectorAll('.rail .navrow')].find((b) => /Statblock/.test(b.textContent))?.click());
  await p.waitForTimeout(350);
  /* Eine Liste, nicht eine Zeile je Karte: eigene Felder zuerst, geerbte
     darunter mit dem Bestandteil, der sie mitbringt. */
  const felderDa = await p.evaluate(() => ({
    alle: [...document.querySelectorAll('.fbox .frow .fk')].map((x) => x.textContent),
    geerbt: [...document.querySelectorAll('.fbox .frow.inh')].length,
  }));
  pruefe('every field stands in one list', felderDa.alle.some((k) => /^passivePerception/.test(k)),
    felderDa.alle.length);
  pruefe('and an inherited one says which part brings it', felderDa.geerbt > 0, felderDa.geerbt);

  const vorher = await p.evaluate(() => document.querySelectorAll('.rail .navrow').length);
  await p.evaluate(() => {
    const bar = [...document.querySelectorAll('#view .addbar')]
      .find((b) => [...b.querySelectorAll('button')].some((x) => /Create interface/.test(x.textContent)));
    bar.querySelector('input').value = 'Probe';
    [...bar.querySelectorAll('button')].find((x) => /Create interface/.test(x.textContent)).click();
  });
  await p.waitForTimeout(400);
  const nachher = await p.evaluate(() => ({
    anzahl: document.querySelectorAll('.rail .navrow').length,
    gewaehlt: document.querySelector('.regbody h3')?.textContent,
    geerbt: [...document.querySelectorAll('.fbox .frow.inh')].length > 0,
    geschrieben: window.__WROTE__.includes('registry/interfaces'),
  }));
  pruefe('creating a subtype inserts a row', nachher.anzahl === vorher + 1, nachher);
  pruefe('the subtype inherits its fields', nachher.geerbt, nachher);
  pruefe('the subtype is saved', nachher.geschrieben, nachher);
  pruefe('registry raised no exception', errs.length === 0, errs);

  /* 3 — Löschen: eigener Dialog, kein window.confirm */
  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((b) => /All articles/.test(b.textContent))?.click());
  await p.waitForTimeout(250);
  const vorherZeilen = await p.evaluate(() => document.querySelectorAll('#view .row').length);
  await p.evaluate(() => document.querySelector('#view .row').click());
  await p.waitForTimeout(200);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => b.textContent === 'Delete').click());
  await p.waitForTimeout(200);
  const gefragt = await p.evaluate(() => ({
    dlg: !!document.querySelector('.dlg'),
    knoepfe: [...document.querySelectorAll('.dlgbox .rowbtns button')].map((b) => b.textContent),
  }));
  pruefe('delete asks inside the page', gefragt.dlg, gefragt);

  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);
  const abgebrochen = await p.evaluate(() => window.__DELETED__.length);
  pruefe('cancel deletes nothing', abgebrochen === 0, abgebrochen);

  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => b.textContent === 'Delete').click());
  await p.waitForTimeout(150);
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Delete/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const geloescht = await p.evaluate(() => ({
    weg: window.__DELETED__,
    zeilen: document.querySelectorAll('#view .row').length,
  }));
  pruefe('delete removes the article', geloescht.weg.length === 1, geloescht);
  pruefe('the list gets shorter', geloescht.zeilen === vorherZeilen - 1, { vorherZeilen, ...geloescht });
  pruefe('no browser modal — discarded in the iframe', modale.length === 0, modale);

  /* 4 — Feldarten: Farbe, Auswahl, Verweis; Schlüssel umbenennen */
  const zumFeld = async (iface, key) => {
    await zumTyp(p, iface);
    if (!key) return;
    /* Geerbte Zeilen haben kein „⋯" — ein Feld wird dort geändert, wo es
       erklärt wird, und nicht dort, wo es ankommt. */
    await p.evaluate((k) => {
      const row = [...document.querySelectorAll('.fbox .frow')]
        .find((r) => !r.classList.contains('inh') && r.querySelector('.fk')?.textContent.startsWith(k));
      if (row.parentElement.querySelector('.fmore')) return;
      [...row.querySelectorAll('button')].find((b) => b.textContent === '⋯').click();
    }, key);
    await p.waitForTimeout(200);
  };

  await zumFeld('Faction', 'color');
  const arten = await p.evaluate(() => {
    const row = [...document.querySelectorAll('.fbox .frow')].find((r) => r.querySelector('.fk')?.textContent === 'color');
    return [...row.querySelector('select').options].map((o) => o.value);
  });
  pruefe('every field kind is offered', ['color', 'link', 'choice'].every((k) => arten.includes(k)), arten);

  await p.evaluate(() => {
    const row = [...document.querySelectorAll('.fbox .frow')].find((r) => r.querySelector('.fk')?.textContent === 'color');
    const sel = row.querySelector('select');
    sel.value = 'color';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('#view .row')].find((r) => /Auge/.test(r.textContent)).click());
  await p.waitForTimeout(200);
  await p.waitForTimeout(250);
  const farbe = await p.evaluate(() => document.querySelector('.fld .swatch')?.getAttribute('style') ?? null);
  pruefe('a colour field renders as a swatch', /#8b5cf6/.test(farbe ?? ''), farbe);

  /* Und die Zeile im Register trägt die Form auch schon. Die Prüfung oben
     setzt sie selbst und sagt darum nur, dass der Editor sie setzen kann —
     `Faction.color` stand deshalb lange als blosser String da und zeigte im
     echten Register nie eine Farbe. */
  const formen = await p.evaluate(() => {
    const P = (t, k) => (window.__T__.REG.interfaces[t]?.schema?.properties || {})[k] || {};
    return { faction: P('Faction', 'color').format, bild: P('Image', 'image').format,
             ort: P('Party', 'at').format };
  });
  pruefe('and the registry row already says so',
    formen.faction === 'color' && formen.bild === 'asset' && formen.ort === 'link', formen);

  /* ---- Das Bild wird gezeichnet ----
     Das Element las `Image.ref`, das Register erklärt `Image.image`. Solange
     beides auseinanderlief, zeichnete es nie etwas — und weil ein Artikel
     ohne Bild genauso aussieht wie einer, dessen Bild nicht ankommt, fiel
     es niemandem auf. Deshalb steht die Prüfung hier. */
  const bild = await p.evaluate(() => {
    const T = window.__T__;
    /* Ein Asset, das es gibt, und irgendein Artikel, der keins hat. */
    let asset = null;
    T.ENT.forEach((x) => { if (!asset && (x.interfaces || [])[0] === 'Asset') asset = x; });
    let ziel = null;
    T.ENT.forEach((x) => {
      if (!ziel && (x.interfaces || [])[0] === 'Place') ziel = x;
    });
    if (!asset || !ziel) return { fehlt: true };
    ziel.components.Image = { image: asset.id, caption: 'Vom Lampenplatz aus' };
    T.go({ k: 'art', id: ziel.id });
    return new Promise((r) => setTimeout(() => r({
      quelle: document.querySelector('#view .pic img')?.getAttribute('src') ?? null,
      unterschrift: document.querySelector('#view .pic figcaption')?.textContent ?? null,
    }), 400));
  });
  await p.waitForTimeout(300);
  pruefe('an image field actually draws its picture',
    !bild.fehlt && !!bild.quelle && bild.unterschrift === 'Vom Lampenplatz aus', bild);

  /* Umbenennen muss Schema, Ansichten UND die Werte in den Artikeln treffen —
     wer nur das Schema ändert, lässt die Werte still hinter dem alten Namen. */
  await zumFeld('Statblock', 'hp');
  await p.evaluate(() => {
    const box = [...document.querySelectorAll('.fbox .fmore')][0];
    const keyIn = [...box.querySelectorAll('label.f')]
      .find((l) => /Key/.test(l.querySelector('span').textContent)).querySelector('input');
    keyIn.value = 'hitPoints';
    keyIn.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(400);
  const umbenannt = await p.evaluate(() => ({
    banner: document.querySelector('#view .banner')?.textContent ?? '',
    felder: [...document.querySelectorAll('.fbox .frow .fk')].map((x) => x.textContent),
    geschrieben: window.__WROTE__,
  }));
  pruefe('renaming a key rewrites the schema', umbenannt.felder.includes('hitPoints') && !umbenannt.felder.includes('hp'), umbenannt.felder.slice(0, 5));
  pruefe('renaming a key rewrites the articles', /article/.test(umbenannt.banner) && umbenannt.geschrieben.some((x) => x.startsWith('entities/')), umbenannt.banner);
  /* Früher nannten die Ansichten einzelne Felder (`Statblock.hp`), und
     das Umbenennen musste sie mitziehen. Seit es drei Stufen gibt, die
     `fields: 'all'` sagen, nennt keine Ansicht mehr ein Feld — die
     eigentliche Zusicherung ist deshalb: **nirgends bleibt der alte Name
     stehen.** Das ist die Frage, um die es immer ging. */
  const keinRest = await p.evaluate(() => {
    const T = window.__T__;
    const hay = JSON.stringify({ views: T.REG.views, components: T.REG.interfaces });
    return { alt: /Statblock\.hp\b/.test(hay), neu: /hitPoints/.test(hay) };
  });
  pruefe('renaming a key leaves no stale reference behind',
    keinRest.alt === false && keinRest.neu === true, keinRest);

  /* Verweisfeld: Zielbeschränkung engt ein, Vorschlag speichert die Id */
  await zumFeld('Creature', null);
  await p.evaluate(() => {
    const bar = [...document.querySelectorAll('.fbox .addbar')][0];
    const [k, t] = bar.querySelectorAll('input');
    k.value = 'home';
    t.value = 'Home';
    [...bar.querySelectorAll('button')].find((b) => /Add field/.test(b.textContent)).click();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const row = [...document.querySelectorAll('.fbox .frow')].find((r) => r.querySelector('.fk')?.textContent === 'home');
    const sel = row.querySelector('select');
    sel.value = 'link';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const offen = await p.evaluate(() => document.querySelector('.tgt .hint')?.textContent ?? '');
  await p.evaluate(() => {
    const sel = document.querySelector('.tgt select');
    [...sel.options].forEach((o) => { o.selected = /Place/.test(o.textContent); });
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const eng = await p.evaluate(() => document.querySelector('.tgt .hint')?.textContent ?? '');
  const zahl = (t) => Number((t.match(/^(\d+)/) ?? [])[1] ?? -1);
  pruefe('a target constraint narrows the candidates', zahl(eng) > 0 && zahl(eng) < zahl(offen), { offen, eng });

  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(200);
  /* Genau dieser Artikel, nicht „irgendeiner mit Volo drin". Eine Tat hiess
     später „Volo aus dem Schleimgang geholt" und stand alphabetisch davor —
     die Prüfung öffnete sie und fand keine Artikelseite. */
  await p.evaluate(() => [...document.querySelectorAll('#view .row')]
    .find((r) => /^Volothamp/.test(r.textContent.trim())).click());
  await p.waitForTimeout(200);
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Edit all fields/.test(b.textContent)).click());
  await p.waitForTimeout(350);
  await p.evaluate(() => {
    const inp = document.querySelector('.linkbox input');
    inp.value = 'kerz';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(200);
  const treffer = await p.evaluate(() => [...document.querySelectorAll('.sugg button')].map((b) => b.textContent));
  pruefe('typing filters the link suggestions', treffer.length === 1 && /Kerzengasse/.test(treffer[0]), treffer);

  await p.evaluate(() =>
    document.querySelector('.sugg button').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await p.waitForTimeout(200);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Done editing/.test(b.textContent)).click());
  await p.waitForTimeout(400);
  const verweis = await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Home');
    return dt ? { wert: dt.nextElementSibling.textContent, klickbar: !!dt.nextElementSibling.querySelector('button.ref') } : null;
  });
  pruefe('a picked link is stored and renders as a jump', verweis?.klickbar === true && /Kerzengasse/.test(verweis?.wert ?? ''), verweis);

  /* **Ein Verweis zeigt seine Übersicht, bevor man ihm folgt.** Name,
     Artikelart und der eine Satz — mehr hat neben einem Verweis im Satz
     keinen Platz, und wer mehr will, klickt. Gebaut wird der Blick erst
     beim Hinfahren: eine Seite mit vierzig Verweisen zeichnete sonst
     vierzig Artikel mit, von denen man keinen anschaut. */
  const blick = await p.evaluate(async () => {
    const ref = [...document.querySelectorAll('.blk .refw > button.ref, .fld .refw > button.ref')][0]
      || document.querySelector('.refw > button.ref');
    if (!ref) return { keiner: true };
    const vorher = document.querySelectorAll('.refpop').length;
    ref.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    await new Promise((r) => setTimeout(r, 200));
    const pop = ref.parentElement.querySelector('.refpop');
    return {
      vorher,
      da: !!pop,
      name: pop?.querySelector('b')?.textContent ?? '',
      /* Eine Übersicht ist ein Satz und keine Feldtabelle. */
      felder: pop ? pop.querySelectorAll('.fields').length : -1,
      text: (pop?.textContent ?? '').length,
    };
  });
  /* **Was leer ist, steht nicht da — aber es ist zu haben.** Eine Seite,
     die jedes mögliche Feld als Strich zeigt, liest sich wie ein Formular;
     eine, die es verschweigt, lässt es nie jemand ausfüllen. Also eine
     Zeile darunter, die aufzählt, was die Art noch trüge — und ein Griff
     hinein macht daraus ein offenes Feld. */
  const angebot = await p.evaluate(async () => {
    const T = window.__T__;
    const npc = [...T.ENT.values()].find((x) => (x.interfaces || [])[0] === 'Creature');
    T.go({ k: 'art', id: npc.id });
    await new Promise((r) => setTimeout(r, 400));
    const sel = document.querySelector('.addfield select');
    if (!sel) return { keins: true };
    const vorher = document.querySelectorAll('.fields .fld').length;
    const wahl = sel.options[1].value;
    /* Leer heisst leer: kein Feld der Tabelle darf schon so heissen. */
    const schon = [...document.querySelectorAll('.fields .fld dt')].map((x) => x.textContent);
    sel.value = wahl;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    return {
      angeboten: sel.options.length - 1,
      vorher,
      schon,
      wahl,
      nachher: document.querySelectorAll('.fields .fld').length,
      offen: !!document.querySelector('.fld dd.editing'),
    };
  });
  pruefe('an empty field is not shown, but it is on offer',
    angebot.keins !== true && angebot.angeboten > 5
    && !angebot.schon.includes('Audience'), angebot);
  pruefe('and picking one opens it right there',
    angebot.nachher === angebot.vorher + 1 && angebot.offen === true, angebot);

  /* **Einheiten werden beim Lesen gerechnet, nie gespeichert** (D8). Der
     Vault ist imperial, weil die Regeln es sind; am Tisch sitzen Leute,
     für die vierzig Fuss nichts bedeuten. Beides in die Daten zu schreiben
     hiesse, zwei Zahlen zu haben, die sich widersprechen können. */
  const masse = await p.evaluate(() => {
    const T = window.__T__;
    return {
      zeilen: Object.keys(T.REG.units || {}).length,
      /* Nach Grössenordnung: drei Meilen sind knapp fünf Kilometer und
         nicht 4828 Meter. */
      beide: T.formatMeasure(40, 'ft', 'both'),
      weit: T.formatMeasure(3, 'mi', 'both'),
      nurMetrisch: T.formatMeasure(30, 'lb', 'metric'),
      nurImperial: T.formatMeasure(1.5, 'm', 'imperial'),
      /* Im Fliesstext: angefasst wird nur, was wie ein Mass aussieht. */
      text: T.convertText('40 ft, climb 20 ft — and a rope', 'metric'),
      /* Eine unbekannte Einheit bleibt stehen. Eine irreführende Zahl ist
         schlimmer als keine. */
      fremd: T.convertText('7 zorp of nothing', 'metric'),
      /* Und welches System gilt, sagt die Art oder die Einstellung. */
      proArt: T.unitsFor('Creature'),
    };
  });
  pruefe('units are a registry row, and the conversion picks the right magnitude',
    masse.zeilen > 8 && /12\.2/.test(masse.beide) && /m\b/.test(masse.beide)
    && /4\.8/.test(masse.weit) && /km/.test(masse.weit), masse);
  pruefe('one system only shows only that one',
    /kg/.test(masse.nurMetrisch) && !/lb/.test(masse.nurMetrisch)
    && /ft/.test(masse.nurImperial) && !/\bm\b/.test(masse.nurImperial), masse);
  pruefe('a measure inside prose is converted, and nothing else is touched',
    /climb/.test(masse.text) && /rope/.test(masse.text) && !/ft/.test(masse.text)
    && masse.fremd === '7 zorp of nothing', masse);

  /* **Ein Mass nennt die Einheit, in der es dasteht.** Drei Felder taten
     das nicht — `Statblock.speed`, `Weapon.range`, `Map.scale` —, und
     umgerechnet wird aus der gespeicherten Einheit: ohne sie rechnete
     nichts, und das sah aus wie eine Zahl, die schon stimmt. Das
     Ausgangsmass greift nur, wo keine Zahl ihre Einheit nennen kann. */
  const ausgangs = await p.evaluate(() => {
    const T = window.__T__;
    const sp = T.REG.interfaces.Statblock.schema.properties.speed;
    return {
      unit: sp.unit,
      nackt: T.convertText('40', 'metric', 'ft'),
      ohneAnnahme: T.convertText('40', 'metric'),
      bereich: T.convertText('30/120', 'metric', 'ft'),
      mitWort: T.convertText('7 zorp', 'metric', 'ft'),
      gezeichnet: T.fmtVal(sp, '40', 'Statblock'),
      karte: T.REG.interfaces.Map.schema.properties.scale.unit,
    };
  });
  pruefe('a bare number takes the field unit, and a word stops the guessing',
    ausgangs.unit === 'ft' && /12\.2/.test(ausgangs.nackt)
    && ausgangs.ohneAnnahme === '40' && ausgangs.mitWort === '7 zorp'
    && /9\.1/.test(ausgangs.bereich) && /36\.6/.test(ausgangs.bereich)
    && /ft/.test(ausgangs.gezeichnet) && /m\)/.test(ausgangs.gezeichnet)
    && ausgangs.karte === 'm', ausgangs);

  /* **Ein Verweisfeld nennt seinen Zieltyp.** Vier Felder hielten die Id
     von irgendetwas — „Scene in play" nahm eine Rüstung. Geprüft wird die
     Art und nur die: Marken lesen den heutigen Zustand des Ziels, und ein
     entfernter Marker würde einen gespeicherten Verweis rückwirkend
     falsch machen. */
  const zielTyp = await p.evaluate(() => {
    const T = window.__T__;
    const pd = T.REG.interfaces.Session.schema.properties.activeMap;
    /* Ein Artikel jeder Art, ohne etwas zu speichern. */
    let karte = null, andere = null, sitzung = null;
    T.ENT.forEach((e) => {
      const art = (e.interfaces || [])[0];
      if (art === 'Map' && !karte) karte = e;
      if (art === 'Armor' && !andere) andere = e;
      if (art === 'Session' && !sitzung) sitzung = e;
    });
    if (!karte || !andere || !sitzung) return { fehlt: true, karte: !!karte, andere: !!andere, sitzung: !!sitzung };
    const mit = (id) => ({
      ...sitzung,
      components: { ...sitzung.components, Session: { activeMap: id } },
    });
    const sagt = (e) => T.checkArticle(e).map((x) => x.t).filter((t) => /Map on the table/.test(t));
    return {
      ziel: (pd.target || {}).interfaces,
      richtig: sagt(mit(karte.id)),
      falsch: sagt(mit(andere.id)),
      weg: sagt(mit('gibt-es-nicht')),
      leer: sagt(mit('')),
    };
  });
  pruefe('a link field names its target type, and the check holds it',
    Array.isArray(zielTyp.ziel) && zielTyp.ziel[0] === 'Map'
    && zielTyp.richtig.length === 0 && zielTyp.falsch.length === 1
    && /Armor/.test(zielTyp.falsch[0] || '') && zielTyp.weg.length === 1
    && zielTyp.leer.length === 0, zielTyp);

  await zumRegister(p, 'Units');
  const einheiten = await p.evaluate(() => ({
    probe: [...document.querySelectorAll('#view .fbox .frow')].map((r) => r.textContent),
    modus: document.getElementById('unitmode')?.value ?? '',
    zeilen: document.querySelectorAll('#view .regbody .crow').length,
  }));
  pruefe('the units have a page that shows what the setting does',
    einheiten.zeilen > 8 && einheiten.modus === 'both'
    && einheiten.probe.some((x) => /40\s*ft/.test(x) && /m\)/.test(x)), einheiten);

  /* Nur eines zeigen: die Einstellung wirkt, und man sieht es sofort. */
  const umgestellt = await p.evaluate(async () => {
    const sel = document.getElementById('unitmode');
    sel.value = 'metric';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    const nun = [...document.querySelectorAll('#view .fbox .frow')].map((x) => x.textContent);
    const T = window.__T__;
    const heute = T.formatMeasure(40, 'ft', T.unitsFor('Creature'));
    sel.value = 'both';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    return { nun, heute };
  });
  pruefe('switching to one system leaves the other out everywhere',
    umgestellt.nun.every((x) => !/\(/.test(x)) && !/ft/.test(umgestellt.heute),
    umgestellt);

  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);

  pruefe('a reference shows its overview before you follow it',
    blick.keiner !== true && blick.vorher === 0 && blick.da === true
    && blick.name.length > 0 && blick.felder === 0 && blick.text > blick.name.length,
    blick);


  /* 5 — fiel weg: die Importer sind weg (2026-09-20). Was sie prüften —
     englische Namen in der Ausgabe, deutsche Vault-Schlüssel beim Lesen —
     gibt es nicht mehr zu prüfen, und ein Prüflauf gegen Code, den es nicht
     gibt, sagt nur, dass er nicht da ist. */

  /* 6 — Ansichten als Werkzeugkasten, und ein Layout je Typ */
  await zumRegister(p, 'Views');
  const werkzeuge = await p.evaluate(() =>
    [...document.querySelectorAll('.tools button')].map((b) => b.textContent));
  /* „Jedes" heisst: jedes, das die Seite kennt — nicht eine Zahl, die bei
     jedem neuen Element rot wird und dabei nichts über den Werkzeugkasten
     sagt. */
  const bekannt = await p.evaluate(() => window.__T__.LAYOUT_ELEMENTS.map((x) => x[1]));
  pruefe('the toolbox offers every element',
    bekannt.length > 0 && bekannt.every((n) => werkzeuge.includes('+ ' + n))
      && werkzeuge.length === bekannt.length, { werkzeuge, bekannt });

  await p.evaluate(() =>
    document.querySelector('.rail .navrow[data-v="full"]').click());
  await p.waitForTimeout(250);
  const umgewandelt = await p.evaluate(() =>
    [...document.querySelectorAll('.regbody .crow .cl b')].map((c) => c.textContent));
  /* Die alten Ansichten waren eine Sammlung von Schaltern. Sie müssen beim
     Lesen zu Elementen werden, sonst stünde hier eine leere Liste und die
     Ansicht sähe aus, als zeige sie nichts. */
  pruefe('an older view converts into elements', umgewandelt.includes('Description') && umgewandelt.includes('Field table'), umgewandelt);

  /* Genau diese Art, nicht „irgendeine mit Statblock drin": eine Schleife,
     die die letzte Übereinstimmung nimmt, landete früher bei
     `StatblockInfo` — die Anordnung wäre dann an der richtigen Stelle
     gewesen und die Prüfung hätte sie an der falschen gesucht. */
  await p.evaluate(() => {
    const s = [...document.querySelectorAll('.regbody select')]
      .find((x) => [...x.options].some((o) => o.value === 'Statblock'));
    s.value = 'Statblock';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.tools button')].find((b) => /Heading/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const t = document.querySelector('.fbox input');
    t.value = 'Statblocks only';
    t.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  /* So oft nach oben, bis es oben ist — eine feste Zahl stimmt nur, solange
     die Anordnung genau so lang bleibt. */
  for (let i = 0; i < 12; i++) {
    const oben = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.regbody .crow')];
      const r = rows.find((x) => /Heading/.test(x.textContent));
      if (rows.indexOf(r) === 0) return true;
      const up = [...r.querySelectorAll('button')].find((b) => b.textContent === '↑');
      if (up && !up.disabled) up.click();
      return false;
    });
    if (oben) break;
    await p.waitForTimeout(140);
  }
  const reihe = await p.evaluate(() =>
    [...document.querySelectorAll('.regbody .crow .cl b')].map((c) => c.textContent));
  pruefe('elements can be reordered', reihe[0] === 'Heading', reihe);

  const zeig = async (name) => {
    await zurSeite(p, 'Compendium');
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
    await p.waitForTimeout(200);
    await p.evaluate((n) =>
      [...document.querySelectorAll('#view .row')].find((r) => r.textContent.includes(n)).click(), name);
    await p.waitForTimeout(200);
    await p.waitForTimeout(250);
    return p.evaluate(() => [...document.querySelectorAll('#view .sec')].map((x) => x.textContent));
  };
  /* ---- Eine Vorlage nur dort, wo gezeichnet wird ----
     `Identity` ist ein Bestandteil und kein Artikel. „Overview" zeigte dort
     die Beschreibung, die es an ihm gar nicht gibt — und lud dazu ein, eine
     Anordnung an einer Stelle zu ändern, an der sie nichts tut. Ein
     Obertyp, der eine Anordnung **selbst** trägt, behält sie: dort ist sie
     zu ändern. */
  const vorlageBei = async (name) => {
    await zumTyp(p, name);
    return p.evaluate(() => ({
      knopf: [...document.querySelectorAll('.chips .chip.pick[data-vk]')].length,
      elemente: [...document.querySelectorAll('.tmpl .tmplel')].length,
      hinweis: [...document.querySelectorAll('.regbody .hint, #view .hint')]
        .some((x) => /it is a part that other kinds take/.test(x.textContent)),
    }));
  };
  const teil = await vorlageBei('Identity');
  const artikelart = await vorlageBei('Creature');
  /* Und eine Art, die ihre Anordnung **erbt**: die Spielerfigur nimmt die
     der Kreatur. Hier stand einmal der abstrakte Obertyp mit eigener
     Anordnung — den gibt es nicht mehr, seit eine Kreatur selbst eine Art
     ist, und eine Prüfung auf einen Fall, den das Register nicht kennt,
     prüft nichts. Dass geerbte Anordnungen durchreichen, prüft
     `layoutSource` daneben und der Paketlauf mit. */
  const erbend = await vorlageBei('PlayerCharacter');
  pruefe('a part that no article is shows no view template',
    teil.knopf === 0 && teil.elemente === 0 && teil.hinweis, teil);
  pruefe('an article kind shows one',
    artikelart.knopf > 0 && artikelart.elemente > 0 && !artikelart.hinweis, artikelart);
  pruefe('and a kind that inherits its layout shows that one',
    erbend.knopf > 0 && erbend.elemente > 0 && !erbend.hinweis, erbend);

  /* `Prose` und `Notes` hingen einmal an `Identity`, weil das der einzige
     Typ ist, den jede Art erbt. Dann stand unter „Identity" ein Feld
     namens „Text". Ein Basistyp erbt nichts. */
  const idFelder = await p.evaluate(() => {
    const T = window.__T__;
    return { eigen: Object.keys(T.REG.interfaces.Identity.schema.properties),
             erbt: T.REG.interfaces.Identity.extends || [],
             prosa: T.proseFields('Identity').map((f) => f.type + '.' + f.key),
             beimNPC: T.proseFields('Creature').map((f) => f.type + '.' + f.key) };
  });
  pruefe('a base kind inherits nothing, so identity carries no prose',
    idFelder.erbt.length === 0 && idFelder.prosa.length === 0, idFelder);
  pruefe('the article kinds still have their prose',
    idFelder.beimNPC.includes('Prose.paragraph') && idFelder.beimNPC.includes('Notes.note'),
    idFelder.beimNPC);

  /* ---- Ein Typ darf ein geerbtes Feld umbenennen ----
     Derselbe `Time.until` ist an einem Ereignis, wann es aufhört, und an
     einem Auftrag, wann es zu spät ist. Der Bestandteil bleibt einer — nur
     die Beschriftung ist je Typ, und sie steht an dem Typ, der sie meint. */
  const benannt = await p.evaluate(() => {
    const T = window.__T__;
    const von = (art) => T.fieldsOf(art)
      .filter((f) => f.type === 'Time')
      .map((f) => f.key + '=' + T.fieldTitle(art, f.type, f.key, f.prop));
    return { quest: von('Quest'), ereignis: von('Event'),
             woher: T.titleSource('Quest', 'Time', 'until'),
             beiTime: T.titleSource('Time', 'Time', 'until') };
  });
  pruefe('a kind may rename a field it inherits',
    benannt.quest.includes('until=Deadline'), benannt.quest);
  pruefe('and every other kind keeps the name the part brings',
    benannt.ereignis.includes('until=Until'), benannt.ereignis);
  pruefe('the rename says which kind set it',
    benannt.woher === 'Quest' && benannt.beiTime === '', benannt);

  /* Und man ändert sie dort, wo man sie sieht: die Zeile des geerbten
     Feldes trägt ein Eingabefeld, das in den offenen Typ schreibt. */
  await zumTyp(p, 'Quest');
  const umbenennen = await p.evaluate(() => {
    /* `Time` steht als zugeklappte Gruppe da — die Zeilen sind im Baum und
       werden nur gezeigt. Für die Prüfung genügt die Zeile; ein Klick auf
       die Kopfzeile wäre der Weg der Hand. */
    const zeile = [...document.querySelectorAll('.fbox.part .frow.inh')]
      .find((r) => r.querySelector('.fk')?.textContent.replace('*', '') === 'calendar');
    const i = zeile?.querySelector('input');
    if (!i) return { keinFeld: true };
    i.value = 'Reckoning';
    i.dispatchEvent(new Event('change', { bubbles: true }));
    return { getippt: true };
  });
  await p.waitForTimeout(400);
  const titelJetzt = await p.evaluate(() => {
    const T = window.__T__;
    const pd = T.REG.interfaces.Time.schema.properties.calendar;
    return { quest: T.fieldTitle('Quest', 'Time', 'calendar', pd),
             /* …und nur dort. Im Bestandteil steht weiter der eigene Name. */
             teil: pd.title,
             ereignis: T.fieldTitle('Event', 'Time', 'calendar', pd) };
  });
  pruefe('renaming from the type page writes to that type',
    !umbenennen.keinFeld && titelJetzt.quest === 'Reckoning', { umbenennen, titelJetzt });
  pruefe('and leaves the part and its other users alone',
    titelJetzt.teil === 'Calendar' && titelJetzt.ereignis === 'Calendar', titelJetzt);

  /* Zurück auf den eigenen Namen heisst: die Zeile fällt weg. Eine
     Umbenennung, die dasselbe sagt wie das Feld, wird an dem Tag still
     falsch, an dem jemand das Feld umbenennt. */
  const titelZurueck = await p.evaluate(() => {
    const zeile = [...document.querySelectorAll('.fbox.part .frow.inh')]
      .find((r) => r.querySelector('.fk')?.textContent.replace('*', '') === 'calendar');
    const i = zeile?.querySelector('input');
    if (i) { i.value = 'Calendar'; i.dispatchEvent(new Event('change', { bubbles: true })); }
    return true;
  });
  await p.waitForTimeout(400);
  const titelWeg = await p.evaluate(() =>
    ((window.__T__.REG.interfaces.Quest.titles) || {})['Time.calendar']);
  pruefe('a rename that says the same as the field is not kept',
    titelZurueck && titelWeg === undefined, titelWeg);

  /* ---- Die ausgegebene Nummer ----
     `Identity.id` ist `npc-0042` und hiess einmal `key`: `npc/volo-geddarm`,
     also ein Name, der ein zweites Mal derselbe Name war. Beim Umbenennen
     musste er entweder mitwandern — dann war er kein fester Bezeichner —
     oder nicht, und dann log er. */
  const nummern = await p.evaluate(() => {
    const T = window.__T__;
    const alle = [];
    T.ENT.forEach((e) => alle.push({ art: (e.interfaces || [])[0] || '', id: T.articleId(e) }));
    const doppelt = {};
    const gesehen = {};
    for (const x of alle) {
      if (x.id && gesehen[x.id]) doppelt[x.id] = 1;
      gesehen[x.id] = 1;
    }
    return {
      ohne: alle.filter((x) => !x.id).length,
      falscheForm: alle.filter((x) => x.id && !/^[a-z0-9-]+-\d{4}$/.test(x.id)).length,
      /* Der Anfang ist die Artikelart, **wie sie beim Anlegen hiess**.
         Wechselt ein Artikel die Art — drei NSC sind Kreaturen geworden,
         als `NPC` als Art wegfiel —, behält er seine Nummer: sie ist
         `readOnly` und ändert sich nie. Eine Wanderung, die Bezeichner
         umschreibt, wäre genau die Stelle, an der ein fester Bezeichner
         wandert. Geprüft wird darum die Form; dass eine **neue** Nummer die
         Art nennt, prüft `nextId` gleich darunter. */
      fremdeArt: alle.filter((x) => x.id && x.art && x.id.indexOf(T.idPrefix(x.art) + '-') !== 0)
        .map((x) => x.id + ' (' + x.art + ')'),
      doppelt: Object.keys(doppelt),
      naechste: T.nextId('creature'),
      keiner: alle.some((x) => /\//.test(x.id)),
    };
  });
  pruefe('every article carries an issued number', nummern.ohne === 0, nummern);
  pruefe('and it reads kind-runningNumber, not a second copy of the name',
    nummern.falscheForm === 0 && !nummern.keiner, nummern);
  pruefe('no two articles share one', nummern.doppelt.length === 0, nummern.doppelt);

  /* Die nächste ist die höchste plus eins — gezählt wird, was dasteht. Ein
     gespeicherter Zähler wäre eine zweite Stelle, die sagt, wie weit man
     ist, und die nach dem ersten Import falsch steht. */
  const weiter = await p.evaluate(() => {
    const T = window.__T__;
    const hoch = [];
    T.ENT.forEach((e) => {
      /* Gezählt wird, was der Anfang sagt, und nicht, was die Art heute
         ist: die drei gewanderten NSC tragen weiter `npc-000n`. */
      const id = T.articleId(e) || '';
      if (id.indexOf('creature-') === 0) hoch.push(Number(id.split('-').pop()));
    });
    return { erwartet: Math.max(0, ...hoch) + 1, bekommen: T.nextId('Creature'),
             imStapel: T.nextId('Creature', [T.nextId('Creature')]) };
  });
  pruefe('the next number is the highest plus one',
    weiter.bekommen === 'creature-' + String(weiter.erwartet).padStart(4, '0'), weiter);
  /* Und ein Stapel zählt weiter, statt zwanzigmal dieselbe zu vergeben. */
  pruefe('and a batch counts on from what it has just issued',
    weiter.imStapel === 'creature-' + String(weiter.erwartet + 1).padStart(4, '0'), weiter);

  /* Sie steht am Kopf des Artikels — und bekommt auch beim „alles
     bearbeiten" keine Eingabe: sie steht seit dem Anlegen und darf sich
     nicht ändern, sonst hiesse derselbe Artikel morgen anders. */
  await p.evaluate(() => window.__T__.go({ k: 'art', id: 'n_volo' }));
  await p.waitForTimeout(400);
  const tippbar = await p.evaluate(() => {
    const T = window.__T__;
    T.UI.inline = true;
    T.render();
    return new Promise((r) => setTimeout(() => {
      const antwort = {
        amKopf: document.querySelector('.arthead .key')?.textContent ?? '',
        /* Nirgends eine Eingabe, die sie trägt. */
        eingabe: [...document.querySelectorAll('#view input')]
          .some((i) => /^[a-z0-9-]+-\d{4}$/.test(i.value || '')),
      };
      T.UI.inline = false;
      T.render();
      r(antwort);
    }, 350));
  });
  await p.waitForTimeout(300);
  pruefe('the number stands at the head and never becomes an input',
    /^npc-\d{4}$/.test(tippbar.amKopf) && !tippbar.eingabe, tippbar);

  const sb = await zeig('Kanalschleim');
  const npc = await zeig('Volo');
  pruefe('a per-type layout reaches that type', sb.includes('Statblocks only'), sb);
  pruefe('and leaves the other types alone', !npc.includes('Statblocks only'), npc);
  pruefe('views raised no exception', errs.length === 0, errs);

  /* 7 — jeder Registerreiter hat eine Maske, keiner nur ein JSON-Textfeld */
  const masken = {};
  for (const name of ['Types', 'Relations', 'Views', 'Variables']) {
    await zumRegister(p, name);
    masken[name] = await p.evaluate(() => ({
      maske: !!document.querySelector('.regbody'),
      felder: document.querySelectorAll('.regbody label.f, .regbody input.i').length,
      roh: !!document.getElementById('regbox'),
      ausgang: !![...document.querySelectorAll('button')].find((b) => /Edit as JSON/.test(b.textContent)),
    }));
  }
  const ohneMaske = Object.keys(masken).filter((n) => !masken[n].maske || masken[n].roh);
  pruefe('every registry part opens as a form', ohneMaske.length === 0, masken);
  pruefe('and every one keeps the JSON way out',
    Object.keys(masken).every((n) => masken[n].ausgang), masken);

  /* Der Notausgang muss zurückführen, sonst ist er eine Sackgasse. */
  await p.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => /Edit as JSON/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  const imJson = await p.evaluate(() => ({
    roh: !!document.getElementById('regbox'),
    zurueck: !![...document.querySelectorAll('button')].find((b) => /Back to the form/.test(b.textContent)),
  }));
  pruefe('the JSON way out leads back', imJson.roh && imJson.zurueck, imJson);
  /* Und dann auch wirklich zurückgehen: eine Prüfung, die den Zustand
     verstellt stehen lässt, bricht die nächste. */
  await p.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => /Back to the form/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  const zurueckInMaske = await p.evaluate(() => ({
    maske: !!document.querySelector('.regbody'),
    roh: !!document.getElementById('regbox'),
  }));
  pruefe('and the form comes back', zurueckInMaske.maske && !zurueckInMaske.roh, zurueckInMaske);
  pruefe('registry tabs raised no exception', errs.length === 0, errs);

  /* 8 — Bearbeiten in der Ansicht, und die Spur zurück */
  const oeffne = async (name) => {
    await zurSeite(p, 'Compendium');
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
    await p.waitForTimeout(200);
    await p.evaluate((n) =>
      [...document.querySelectorAll('#view .row')].find((r) => r.textContent.includes(n)).click(), name);
    await p.waitForTimeout(200);
    await p.waitForTimeout(250);
  };

  /* Über die Id öffnen, nicht über den Namen: sobald es „Karte: X" und „X"
     gibt, trifft ein Namensklick das Falsche, und die Prüfung meldet dann
     etwas über die Sortierung statt über den Code. */
  const oeffneId = async (id) => {
    await p.evaluate((i) => window.__T__.go({ k: 'art', id: i }), id);
    await p.waitForTimeout(350);
  };

  /* Ein Reiter auf der Artikelseite. Seit ein Charakterbogen Reiter hat,
     liegt nicht mehr alles untereinander — und eine Prüfung, die den
     Reiter nicht umschaltet, prüft eine leere Seite und meldet einen
     Fehler, den es nicht gibt. Fehlt der Reiter, wird nichts getan: dann
     steht der Inhalt ohnehin da. */
  const reiter = async (label) => {
    const da = await p.evaluate((l) => {
      const b = [...document.querySelectorAll('.tabrow .btn')]
        .find((x) => x.textContent.trim() === l);
      if (!b) return false;
      b.click();
      return true;
    }, label);
    if (da) await p.waitForTimeout(300);
    return da;
  };

  const neuerArtikel = async (typ, name) => {
    await p.evaluate(() => document.getElementById('new').click());
    await p.waitForTimeout(250);
    await p.evaluate((t) => {
      const s = [...document.querySelectorAll('.dlgbox select')][0];
      [...s.options].forEach((o) => { if (o.textContent === t) s.value = o.value; });
    }, typ);
    await p.evaluate((n) => { [...document.querySelectorAll('.dlgbox input')][0].value = n; }, name);
    await p.evaluate(() =>
      [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Create/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    return p.evaluate(() => ({
      titel: document.querySelector('.arthead h2')?.textContent,
      typ: document.querySelector('.kicker .pill')?.textContent,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
  };
  await oeffneId('n_volo');

  await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Role');
    dt.nextElementSibling.click();
  });
  await p.waitForTimeout(250);
  const einzeln = await p.evaluate(() => ({
    offen: document.querySelectorAll('.fld dd.editing').length,
    wert: document.querySelector('.fld dd.editing input')?.value ?? null,
  }));
  pruefe('a click opens exactly that one field', einzeln.offen === 1 && einzeln.wert === 'Händler', einzeln);

  await p.evaluate(() => {
    const i = document.querySelector('.fld dd.editing input');
    i.value = 'Chronicler';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const gespeichert = await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Role');
    return { wert: dt?.nextElementSibling.textContent, geschrieben: window.__WROTE__.filter((x) => /n_volo/.test(x)).length,
             nochOffen: document.querySelectorAll('.fld dd.editing').length };
  });
  pruefe('the edit is stored and the field closes',
    gespeichert.wert === 'Chronicler' && gespeichert.geschrieben > 0 && gespeichert.nochOffen === 0, gespeichert);

  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Edit all fields/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const alle = await p.evaluate(() => ({
    offen: document.querySelectorAll('.fld dd.editing').length,
    abgeleitet: [...document.querySelectorAll('.fld.drv dd')].filter((d) => d.classList.contains('editing')).length,
  }));
  /* Ein abgeleitetes Feld hat keinen gespeicherten Wert, in den man
     zurückschreiben könnte. Ein Eingabefeld dafür verspräche eine
     Änderung, die nicht stattfinden kann. */
  pruefe('the switch opens every field but the derived ones',
    alle.offen > 1 && alle.abgeleitet === 0, alle);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Done editing/.test(b.textContent)).click());
  await p.waitForTimeout(200);

  const spring = async () => {
    await p.evaluate(() => { const b = [...document.querySelectorAll('#aside button.ref')][0]; if (b) b.click(); });
    await p.waitForTimeout(280);
    return p.evaluate(() => ({
      krumen: [...document.querySelectorAll('.crumbs button')].map((b) => b.textContent),
      hier: document.querySelector('.arthead h2')?.textContent,
    }));
  };
  /* Woher der Sprung ausging, steht am Artikel — nicht in dieser Datei.
     Den Namen fest einzutragen hiess: die Prüfung wird rot, sobald jemand
     den Artikel umbenennt, und sagt dabei nichts über die Spur. */
  const start = await p.evaluate(() => document.querySelector('.arthead h2')?.textContent);
  const s1 = await spring();
  const s2 = await spring();
  const s3 = await spring();
  pruefe('every jump leaves a crumb', s3.krumen.length === 3 && s1.krumen[0] === start,
    { start, s1, s2, s3 });
  /* Und sie stehen **über** der Navigation und nicht im Artikel: sie sagen,
     wo man ist, und das gehört zur Navigation. Im Artikel standen sie unter
     dem Seitenwechsel und sahen aus wie ein Teil des Artikels. */
  const wo = await p.evaluate(() => {
    const bar = document.querySelector('.crumbs');
    const nav = document.getElementById('pages');
    if (!bar || !nav) return null;
    return {
      ausserhalb: !document.getElementById('view').contains(bar),
      ueber: !!(bar.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING),
      /* Der Artikel, auf dem man steht, steht am Ende der Spur — sonst
         sagte sie, woher man kam, und nicht, wo man ist. */
      letzte: bar.querySelector('.hier')?.textContent ?? '',
    };
  });
  pruefe('the crumbs sit above the navigation, and name where you are',
    wo && wo.ausserhalb && wo.ueber && wo.letzte === s3.hier, { wo, hier: s3.hier });

  /* Zurück auf etwas, das schon in der Spur steht, schneidet sie dort ab.
     Sonst wüchse sie beim Hin und Her ins Endlose. */
  await p.evaluate(() => [...document.querySelectorAll('.crumbs button')][1].click());
  await p.waitForTimeout(250);
  const zurueck = await p.evaluate(() => ({
    krumen: [...document.querySelectorAll('.crumbs button')].map((b) => b.textContent),
    hier: document.querySelector('.arthead h2')?.textContent,
  }));
  pruefe('a crumb truncates the trail instead of growing it',
    zurueck.hier === s2.krumen[1] && zurueck.krumen.length === 1, { zurueck, s2 });


  /* Name und Tags gehören mit in die Ansicht — sonst wäre der Dialog der
     einzige Weg dorthin, und der ist aus der Artikelleiste verschwunden.
     Umbenannt wird ein eigener Artikel: eine Prüfung, die Kampagnendaten
     ändert, bricht die nächste, und der Fehler steht dann weit weg. */
  await neuerArtikel('Place', 'Probe quarter');
  const eigeneId = await p.evaluate(() => window.__T__.UI.route.id);
  await p.evaluate(() => document.querySelector('.arthead h2').click());
  await p.waitForTimeout(250);
  const nameOffen = await p.evaluate(() => document.querySelector('.arthead input')?.value ?? null);
  await p.evaluate(() => {
    const i = document.querySelector('.arthead input');
    i.value = 'Mist District';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const nameNeu = await p.evaluate((id) => ({
    titel: document.querySelector('.arthead h2')?.textContent,
    geschrieben: window.__WROTE__.filter((x) => x.includes(id)).length,
  }), eigeneId);
  pruefe('the name is editable in place',
    nameOffen === 'Probe quarter' && nameNeu.titel === 'Mist District' && nameNeu.geschrieben > 0,
    { nameOffen, nameNeu });

  await p.evaluate(() => [...document.querySelectorAll('.kicker button.tag')].pop().click());
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const i = document.querySelector('.kicker input');
    i.value = 'underwatch, fog';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const tags = await p.evaluate(() =>
    [...document.querySelectorAll('.kicker button.tag')].map((b) => b.textContent));
  pruefe('the tags are editable in place',
    tags.includes('#underwatch') && tags.includes('#fog'), tags);
  pruefe('in-place editing raised no exception', errs.length === 0, errs);

  /* 9 — Massenbearbeitung */
  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.listhead button')].find((b) => /Select/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  await p.evaluate(() => { [...document.querySelectorAll('#view .row')].slice(0, 3).forEach((r) => r.click()); });
  await p.waitForTimeout(300);
  const gewaehlt = await p.evaluate(() => ({
    markiert: document.querySelectorAll('.row.picked').length,
    zaehler: document.querySelector('.bulk .count')?.textContent ?? '',
  }));
  pruefe('rows can be picked', gewaehlt.markiert === 3 && /3 selected/.test(gewaehlt.zaehler), gewaehlt);

  await p.evaluate(() => {
    const i = document.querySelector('.bulk input');
    i.value = 'bulktest';
    [...document.querySelectorAll('.bulk button')].find((b) => /\+ tags/.test(b.textContent)).click();
  });
  await p.waitForTimeout(400);
  const getaggt = await p.evaluate(() => ({
    banner: document.querySelector('#view .banner')?.textContent ?? '',
    mitTag: [...document.querySelectorAll('#view .row')].filter((r) => /bulktest/.test(r.textContent)).length,
    geschrieben: window.__WROTE__.filter((x) => x.startsWith('entities/')).length,
  }));
  pruefe('a tag reaches every picked article',
    getaggt.mitTag === 3 && /3 articles/.test(getaggt.banner) && getaggt.geschrieben >= 3, getaggt);

  /* Die Auswahl gilt für das, was in der Liste steht. Sonst löschte eine
     geänderte Suche Artikel, die nie auf dem Schirm waren. */
  await p.evaluate(() => { [...document.querySelectorAll('#view .row')].slice(0, 3).forEach((r) => r.click()); });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const q = document.getElementById('q');
    q.value = 'zzzzz-nichts';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const q = document.getElementById('q');
    q.value = '';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const nachSuche = await p.evaluate(() => document.querySelectorAll('.row.picked').length);
  pruefe('a search that hides a row drops it from the selection', nachSuche === 0, nachSuche);

  /* Name und Identitätsschlüssel sind Identität, keine Eigenschaft — sie auf
     allen gleich zu setzen machte Dubletten, die kein Verweis mehr trennt. */
  await p.evaluate(() => { [...document.querySelectorAll('#view .row')].slice(0, 2).forEach((r) => r.click()); });
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.bulk button')].find((b) => /Set a field/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const feldWahl = await p.evaluate(() =>
    [...(document.querySelector('.dlgbox select')?.options ?? [])].map((o) => o.textContent));
  pruefe('bulk field setting offers no identity field',
    feldWahl.length > 0 && !feldWahl.some((t) => /Name · Name|Identity · Key/.test(t)), feldWahl.slice(0, 6));
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);

  /* Der Auswahlmodus bleibt sonst an, und der nächste Klick auf eine Zeile
     wählt sie aus, statt den Artikel zu öffnen. Eine Prüfung, die etwas
     aufmacht, räumt es auch weg. */
  await p.evaluate(() =>
    [...document.querySelectorAll('#view button')].find((b) => /Done selecting/.test(b.textContent))?.click());
  await p.waitForTimeout(250);
  const nochAuswahl = await p.evaluate(() =>
    [...document.querySelectorAll('#view button')].some((b) => /Done selecting/.test(b.textContent)));
  pruefe('selection mode is off again afterwards', nochAuswahl === false, nochAuswahl);

  pruefe('bulk editing raised no exception', errs.length === 0, errs);

  /* 10 — Seitenaufbau: sechs Seiten oben, und jede zeigt in der Leiste, was
     in ihr steckt. Vorher standen alle Bereiche untereinander in einer
     einzigen Leiste — wer im Spiel eine Karte suchte, scrollte an der
     halben Kampagne vorbei. */
  const seiten = await p.evaluate(() =>
    [...document.querySelectorAll('#pages button')].map((b) => b.textContent));
  pruefe('six pages stand at the top',
    ['Registry', 'Compendium', 'World', 'History', 'Rules', 'Play']
      .every((n, i) => seiten[i] === n) && seiten.length === 6, seiten);

  /* Und die Leiste zeigt genau die Seite, auf der man steht. Im Register
     sagen die Reiter oben, in welchem Teil man ist, und die Leiste zeigt
     die Zeilen darin — beim Teil „Types" also die Artikelarten. */
  const leisten = {};
  for (const n of ['Registry', 'World', 'History', 'Play']) {
    if (n === 'Registry') await zumRegister(p, 'Types');
    else await zurSeite(p, n);
    leisten[n] = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.rail button')].map((b) => b.textContent),
      reiter: [...document.querySelectorAll('.tabs button')].map((b) => b.textContent),
    }));
  }
  /* Was nach **Artikeln** fragt, gehört nicht ins Register: „was liegt noch
     halb da", „was ist noch zu tun", „woran hängt die Validierung" fragen
     nach Artikeln und nicht nach den Zeilen, aus denen Artikel gemacht
     sind. Und nachschlagen tut man dort, wo die Regeln stehen. */
  const umgezogen = await p.evaluate(() => {
    const raus = () => [...document.querySelectorAll('.rail button')].map((b) => b.textContent);
    return { reg: raus() };
  });
  await zurSeite(p, 'Compendium');
  umgezogen.komp = await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].map((b) => b.textContent));
  await zurSeite(p, 'Rules');
  umgezogen.regeln = await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].map((b) => b.textContent));
  pruefe('what asks about articles sits with the articles',
    ['Unfinished', 'To do', 'Open issues'].every((w) =>
      umgezogen.komp.some((x) => x.startsWith(w)) && !umgezogen.reg.some((x) => x.startsWith(w)))
    && umgezogen.regeln.some((x) => x.startsWith('Rules'))
    && !umgezogen.reg.some((x) => x.startsWith('Rules')),
    { reg: umgezogen.reg.slice(0, 4), komp: umgezogen.komp.slice(-3), regeln: umgezogen.regeln.slice(-1) });

  /* Der Stapel ist das, was am wenigsten selbsterklärend ist. Er stand als
     ein Wort in der Leiste — jetzt hat er einen Reiter, der sagt, wofür er
     da ist. */
  await zumRegister(p, 'Stack');
  const stapelSeite = await p.evaluate(() => ({
    erklaert: (document.querySelector('#view .hint')?.textContent ?? '').length > 200,
    ebenen: document.querySelectorAll('#view .layers .layer').length,
  }));
  pruefe('the stack says what it is for, and what is running',
    stapelSeite.erklaert && stapelSeite.ebenen > 0, stapelSeite);

  pruefe('each page shows only its own rail',
    leisten.Registry.reiter.includes('Types')
      && leisten.Registry.zeilen.some((x) => /^Article/.test(x))
      && leisten.World.zeilen.some((x) => /^Creature/.test(x))
      && !leisten.World.reiter.length
      && leisten.History.zeilen.some((x) => /^Quest/.test(x))
      && !leisten.History.zeilen.some((x) => /^Creature/.test(x))
      && leisten.Play.zeilen.some((x) => /^Map/.test(x)),
    { r: leisten.Registry, w: leisten.World.zeilen.slice(0, 3) });

  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  const aufbau = await p.evaluate(() => ({
    filter: [...document.querySelectorAll('.filters select')].map((s) => s.options[0].textContent),
  }));
  const bereiche = await p.evaluate(() => ({
    npc: window.__T__.areaOf('Creature'),
    quest: window.__T__.areaOf('Quest'),
    rule: window.__T__.areaOf('Rule'),
    item: window.__T__.areaOf('Item'),
    map: window.__T__.areaOf('Map'),
    /* Und geerbt wie alles andere: eine Artikelart, die im Prototyp neu
       entsteht, trägt keine eigene Angabe — sie muss die ihres Obertyps
       bekommen, sonst wäre sie nirgends auffindbar. */
    geerbt: (() => {
      const T = window.__T__;
      T.REG.interfaces.ProbeArt = { name: 'ProbeArt', label: 'Probe art', extends: ['Creature'] };
      const a = T.areaOf('ProbeArt');
      delete T.REG.interfaces.ProbeArt;
      return a;
    })(),
  }));
  pruefe('an article kind finds its area in the registry, and inherits it',
    bereiche.npc === 'world' && bereiche.quest === 'history'
      && bereiche.rule === 'rules' && bereiche.map === 'play'
      && bereiche.item === 'world'
      && bereiche.geerbt === 'world', bereiche);
  pruefe('the compendium carries its filters',
    aufbau.filter.length === 3 && aufbau.filter[0] === 'any type', aufbau.filter);

  /* Marken sind ein Feld wie jedes andere: der Bestandteil `Tags` bringt
     sie mit, und eine Art, die ihn nicht erbt, trägt keine. Vorher war
     `tags` eine Eigenschaft der Entität — die einzige, die keiner Art
     gehörte, und damit die einzige, die man nirgends weglassen konnte. */
  const markenFeld = await p.evaluate(() => {
    const T = window.__T__;
    const arten = Object.keys(T.REG.interfaces).filter((n) => !T.REG.interfaces[n].abstract);
    return {
      arten: arten.length,
      ohne: arten.filter((n) => T.compsFor(n).indexOf('Tags') < 0),
      feld: (T.REG.interfaces.Tags?.schema?.properties ?? {}).tags?.format ?? null,
      /* Und an der Entität steht nichts mehr. */
      nochOben: [...T.ENT.values()].filter((e) => 'tags' in e).length,
    };
  });
  pruefe('every article kind inherits its tags, and none carries them at the envelope',
    markenFeld.arten > 20 && markenFeld.ohne.length === 0
    && markenFeld.feld === 'tags' && markenFeld.nochOben === 0, markenFeld);

  /* Die Marken bekommen eine eigene Ansicht. Eine Wolke in der Leiste
     wächst mit der Kampagne, bis sie die Leiste füllt, und sagt bei keiner
     Marke, wie oft sie vergeben ist. */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((b) => /^Tags/.test(b.textContent)).click());
  await p.waitForTimeout(350);
  const markenSeite = await p.evaluate(() => ({
    kopf: document.querySelector('#view .listhead h2')?.textContent ?? '',
    zeilen: [...document.querySelectorAll('.tagtab .tagrow')].map((r) => ({
      marke: r.querySelector('.tag')?.textContent ?? '',
      zahl: Number(r.querySelector('.count')?.textContent ?? '0'),
      arten: [...r.querySelectorAll('.tagkinds .pill')].length,
    })),
    /* Nur was dieser Betrachter sehen darf: eine Marke, die allein an
       einem zurückgehaltenen Artikel hängt, gehört nicht in die
       Übersicht — sie verriete, dass es ihn gibt. */
    imBestand: (() => {
      const T = window.__T__;
      const alle = new Set();
      T.ENT.forEach((e) => { if (T.articleVisible(e)) T.tagsOf(e).forEach((t) => alle.add(t)); });
      return alle.size;
    })(),
  }));
  pruefe('the tags open as a view of their own, with a count and the kinds that carry them',
    markenSeite.kopf === 'Tags'
    && markenSeite.zeilen.length === markenSeite.imBestand
    && markenSeite.zeilen.every((z) => z.zahl > 0 && z.arten > 0),
    { kopf: markenSeite.kopf, n: markenSeite.zeilen.length, soll: markenSeite.imBestand });
  /* Die häufigste zuerst: eine alphabetische Liste beantwortet die Frage
     nicht, die man an eine Markenübersicht hat. */
  pruefe('the most used tag stands first',
    markenSeite.zeilen.length > 1
    && markenSeite.zeilen[0].zahl >= markenSeite.zeilen[markenSeite.zeilen.length - 1].zahl,
    markenSeite.zeilen.slice(0, 3));

  await p.evaluate(() => document.querySelector('.tagtab .tagrow').click());
  await p.waitForTimeout(350);
  const gefiltert = await p.evaluate(() => ({
    pille: [...document.querySelectorAll('#view .listhead .pill')].map((x) => x.textContent),
    zeilen: document.querySelectorAll('#view .row').length,
  }));
  pruefe('a tag row filters the list to that tag',
    gefiltert.pille.some((x) => x === '#' + markenSeite.zeilen[0].marke)
    && gefiltert.zeilen === markenSeite.zeilen[0].zahl, { gefiltert, soll: markenSeite.zeilen[0] });

  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);

  /* Ein Obertyp meint seine Subtypen mit. Exakt zu vergleichen hiesse:
     „Item" zeigt nichts, obwohl jede Waffe eins ist. */
  const vorFilter = await p.evaluate(() => document.querySelectorAll('#view .row').length);
  /* Welcher Obertyp geprüft wird, sagen die Daten: der erste, der einen
     echten Subtyp trägt, auf dem Artikel liegen. „Item" fest zu verdrahten
     hiess, dass die Prüfung rot wurde, sobald der letzte Gegenstand aus der
     Kampagne verschwand — und das sagte nichts über den Filter. */
  const paar = await p.evaluate(() => {
    const R = window.__T__.REG.interfaces;
    /* Der **erste** Eintrag ist der Obertyp, an dem der Baum zeichnet;
       weitere sind Beimischungen und filtern quer durch alles. */
    const parent = (n) => (R[n]?.extends || [])[0];
    const treffer = {};
    window.__T__.ENT.forEach((e) => {
      let at = parent((e.interfaces || [])[0]);
      const eigen = (e.interfaces || [])[0];
      while (at) { (treffer[at] = treffer[at] || new Set()).add(eigen); at = parent(at); }
    });
    for (const [ober, unter] of Object.entries(treffer)) {
      if (R[ober]?.area && unter.size) {
        const u = [...unter][0];
        return { ober, unter: u, label: R[u]?.label || u };
      }
    }
    return null;
  });
  pruefe('the data offers a parent type with articles below it', paar !== null, paar);
  await p.evaluate((ober) => {
    const s = document.querySelector('.filters select');
    s.value = ober;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, paar.ober);
  await p.waitForTimeout(300);
  const nachFilter = await p.evaluate(() => ({
    zeilen: document.querySelectorAll('#view .row').length,
    typen: [...new Set([...document.querySelectorAll('#view .row .pill')].map((x) => x.textContent))],
  }));
  pruefe('a parent type filters its subtypes in',
    nachFilter.zeilen > 0 && nachFilter.zeilen < vorFilter
      && nachFilter.typen.includes(paar.label),
    { paar, vorFilter, nachFilter });

  await p.evaluate(() =>
    [...document.querySelectorAll('.filters button')].find((b) => /Clear filters/.test(b.textContent))?.click());
  await p.waitForTimeout(250);
  const geleert = await p.evaluate(() => document.querySelectorAll('#view .row').length);
  pruefe('clearing the filters brings everything back', geleert === vorFilter, { geleert, vorFilter });

  await zumRegister(p, 'How it works');
  const dm = await p.evaluate(() => ({
    titel: document.querySelector('#view h2')?.textContent,
    begriffe: [...document.querySelectorAll('.kdl dt')].map((x) => x.textContent),
    reiter: [...document.querySelectorAll('.tabs button')].map((x) => x.textContent),
    knoten: [...document.querySelectorAll('.tree .tnode .tw')].map((x) => x.textContent),
    felder: document.querySelectorAll('.tree .tfield').length,
    belegt: document.querySelectorAll('.tree .tfield.on').length,
  }));
  /* Die Mechanik gehört auf die Seite, die sie bearbeitet — sonst steht sie
     nur in Commit-Nachrichten. Und sie wird aus dem Register gezogen: eine
     Erklärung, die eine Liste abtippt, stimmt am Tag ihrer Entstehung. */
  pruefe('the registry explains its own words',
    dm.titel === 'Registry'
    && ['How it works', 'Types', 'Views', 'Relations', 'Variables', 'Settings',
      'Backup', 'Stack', 'Graph'].every((t) => dm.reiter.includes(t))
    && ['Type', 'Part', 'Field', 'Identifier', 'Article', 'View', 'Block', 'Edge', 'Unit']
      .every((w, i) => dm.begriffe[i] === w), { begriffe: dm.begriffe, reiter: dm.reiter });
  pruefe('and follows one article from its type down to its fields',
    dm.knoten[0] === 'article' && dm.knoten[1] === 'its type'
    && dm.knoten.filter((x) => /^part/.test(x)).length > 3
    && dm.felder > 20 && dm.belegt > 0 && dm.belegt < dm.felder,
    { knoten: dm.knoten.slice(0, 4), felder: dm.felder, belegt: dm.belegt });
  pruefe('the page structure raised no exception', errs.length === 0, errs);

  /* 11 — Standardwerte stehen im Feld, nicht im Code */
  /* Den Stand erklärt `Status` — ein Bestandteil, den jede Artikelart erbt.
     Der Weg dorthin geht über die Artikelarten und nicht über einen Reiter
     „Components", den es nicht mehr gibt. */
  const zumStatusFeld = async () => {
    /* Den Stand erklärt `Status` — ein eigener Bestandteil, seit `Base`
       zerfallen ist. Geändert wird er dort und nicht an einer Art, die ihn
       nur erbt. */
    await zumFeld('Status', 'status');
  };

  const standardFeld = () => p.evaluate(() =>
    [...document.querySelectorAll('.fbox .fmore label.f')]
      .find((l) => /Default/.test(l.querySelector('span').textContent))
      ?.querySelector('select,input') ?? null);

  await zumStatusFeld();
  const stand = await p.evaluate(() => ({
    zeile: [...document.querySelectorAll('.fbox .frow')]
      .find((x) => /^status\b/.test(x.querySelector('.fk')?.textContent ?? ''))?.textContent ?? '',
    wert: [...document.querySelectorAll('.fbox .fmore label.f')]
      .find((l) => /Default/.test(l.querySelector('span').textContent))
      ?.querySelector('select,input')?.value ?? null,
  }));
  pruefe('a field carries its default, and shows it', /← idea/.test(stand.zeile) && stand.wert === 'idea', stand);

  /* ---- Eine Aufzählung, die mehrere Felder teilen ----
     Die sechs Attributkürzel standen wörtlich an der Fertigkeit und am
     Rezept, der Vorbereitungsstand an jedem Artikel. Jetzt steht die Liste
     einmal im Register, und das Feld nennt sie. Geprüft wird beides: dass
     die Zeile sagt, wer sie nennt, und dass ein Feld, dessen Zeile sich
     ändert, danach die neuen Wörter anbietet — sonst wäre die Zeile eine
     Kopie mehr und nicht eine weniger. */
  await zumRegister(p, 'Choices');
  const wahl = await p.evaluate(() => ({
    zeilen: [...document.querySelectorAll('.regbody .crow')].map((r) => ({
      name: r.querySelector('.fk')?.textContent ?? '',
      werte: r.querySelector('input.i:not([type=number]) + input.i')?.value
        ?? [...r.querySelectorAll('input.i')][1]?.value ?? '',
      haengt: r.querySelector('.pill.q')?.getAttribute('title') ?? '',
    })),
  }));
  const ability = wahl.zeilen.find((z) => z.name === 'Ability');
  pruefe('the registry holds the shared choice lists',
    !!ability && /str, dex/.test(ability.werte), wahl.zeilen);
  pruefe('and each one says which fields name it',
    !!ability && /Skill\.ability/.test(ability.haengt) && /Recipe\.ability/.test(ability.haengt),
    ability);

  /* Ein Wort dazu — und das Feld am Artikel kennt es. */
  const gefolgt = await p.evaluate(async () => {
    const T = window.__T__;
    const vorher = T.enumWerte(T.REG.interfaces.Status.schema.properties.status) || [];
    T.REG.enums.State.values = vorher.concat(['shelved']);
    const nachher = T.enumWerte(T.REG.interfaces.Status.schema.properties.status) || [];
    const eingabe = T.fieldInput(T.REG.interfaces.Status.schema.properties.status, 'idea');
    const angeboten = [...(eingabe.options || [])].map((o) => o.value);
    T.REG.enums.State.values = vorher;
    return { vorher, nachher, angeboten };
  });
  pruefe('a field follows the row it names',
    gefolgt.vorher.join() === 'idea,prepared,ready'
    && gefolgt.nachher.includes('shelved')
    && gefolgt.angeboten.includes('shelved'), gefolgt);

  /* Und ein freies Wort schlägt vor, was schon dasteht — `kind` an einer
     Kreatur ist frei, damit eine neue Sorte ein Eintrag ist und keine
     Registerzeile; dieselbe Sorte dreimal anders geschrieben wäre der
     Preis dafür. */
  const vorschlag = await p.evaluate(() => {
    const T = window.__T__;
    const feld = T.REG.interfaces.Creature.schema.properties.kind;
    const node = T.fieldInput(feld, '', { type: 'Creature', key: 'kind' });
    const liste = node.querySelector ? node.querySelector('datalist') : null;
    return {
      frei: !feld.enum && !feld.enumRef,
      vor: liste ? [...liste.options].map((o) => o.getAttribute('value')) : [],
    };
  });
  pruefe('a free word suggests what is already in use',
    vorschlag.frei && vorschlag.vor.includes('npc'), vorschlag);

  /* ---- Mehrere Werte aus mehreren Listen ----
     Worin jemand geübt ist, kommt aus sechs Listen und steht in **einem**
     Feld. Ein Feld je Sorte hiesse, dieselbe Frage sechsmal zu stellen —
     und die siebte Sorte bräuchte ein siebtes Feld. */
  const mehrfach = await p.evaluate(() => {
    const T = window.__T__;
    const pd = T.REG.interfaces.Proficiencies.schema.properties.proficient;
    const node = T.fieldInput(pd, ['stealth', 'Elfisch']);
    return {
      gruppen: [...node.querySelectorAll('.cgroup')].map((x) => x.textContent),
      an: [...node.querySelectorAll('.cchk.on span')].map((x) => x.textContent),
      /* Nach aussen sieht der Kasten aus wie ein Textfeld: so liest ihn
         dieselbe Funktion wie jede andere Liste. */
      wert: node.value,
      /* Und die Rettungswürfe ziehen aus **einer** Liste. */
      saves: T.enumWerte(T.REG.interfaces.Proficiencies.schema.properties.saves),
      quelle: T.enumQuelle(pd, 'Diebeswerkzeug'),
    };
  });
  pruefe('one field draws on several lists, grouped by where they come from',
    mehrfach.gruppen.length === 6 && mehrfach.gruppen.includes('Skill')
    && mehrfach.gruppen.includes('Language')
    && mehrfach.quelle === 'Tool', mehrfach);
  pruefe('and what is picked reads back as a plain list',
    mehrfach.wert === 'stealth, Elfisch' && mehrfach.an.length === 2
    && mehrfach.saves.join() === 'str,dex,con,int,wis,cha', mehrfach);

  const anlegen = async (name) => {
    await p.evaluate(() => document.getElementById('new').click());
    await p.waitForTimeout(300);
    await p.evaluate((n) => { [...document.querySelectorAll('.dlgbox input')][0].value = n; }, name);
    await p.evaluate(() =>
      [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Create/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    return p.evaluate(() => [...document.querySelectorAll('.kicker .pill')].map((x) => x.textContent));
  };
  const erster = await anlegen('Default probe');
  pruefe('a new article gets the default', erster.includes('idea'), erster);

  /* Der Standard stand bis hierher fest in newEntity — also genau die Sorte
     Wissen, die laut Rückgrat eine Registerzeile sein soll. Ihn zu ändern
     muss reichen. */
  await zumStatusFeld();
  await p.evaluate(() => {
    const l = [...document.querySelectorAll('.fbox .fmore label.f')]
      .find((x) => /Default/.test(x.querySelector('span').textContent));
    const n = l.querySelector('select,input');
    n.value = 'prepared';
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const zweiter = await anlegen('Second probe');
  pruefe('changing the default changes what is created next',
    zweiter.includes('prepared') && !zweiter.includes('idea'), zweiter);
  pruefe('defaults raised no exception', errs.length === 0, errs);

  /* 12 — Etappe B: Geschichts- und Spielerartikel sind Registerzeilen.
     Diese Prüfung ist die Probe aufs Rückgrat. Geht sie kaputt, weil jemand
     Code für einen Artikeltyp geschrieben hat, war die Behauptung falsch. */

  const auswahl = await p.evaluate(() => {
    document.getElementById('new').click();
    return [...[...document.querySelectorAll('.dlgbox select')][0].options].map((x) => x.textContent);
  });
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);
  const erwartet = ['Campaign', 'Session', 'Scene / Encounter', 'Quest', 'Player character', 'Party', 'Inventory'];
  pruefe('the story and player types are offered',
    erwartet.every((t) => auswahl.includes(t)), auswahl);
  /* Abstrakte Typen sind Struktur, nicht anlegbar. `Creature` steht hier
     nicht mehr: sie ist selbst eine Art geworden, und `kind` sagt, was für
     eine — der Unterschied zwischen NSC und Begleiter war drei Zeilen ohne
     ein einziges eigenes Feld wert. */
  pruefe('the abstract parents are not offered',
    !auswahl.includes('Story') && !auswahl.includes('Identity')
    && !auswahl.includes('Proficiencies') && auswahl.includes('Creature'), auswahl);

  const kampagne = await neuerArtikel('Campaign', 'Probe campaign');
  const pc = await neuerArtikel('Player character', 'Probe hero');
  pruefe('they validate clean on creation',
    kampagne.probleme.length === 0 && pc.probleme.length === 0, { kampagne, pc });

  await p.waitForTimeout(300);
  const pcFelder = await p.evaluate(() => {
    const o = {};
    document.querySelectorAll('.fld').forEach((f) => { o[f.querySelector('dt').textContent] = f.querySelector('dd').textContent; });
    return o;
  });
  pruefe('a required component arrives with its defaults',
    pcFelder.Level === '1' && pcFelder.Proficiency === '+2', pcFelder);

  /* Der Übungsbonus ist abgeleitet, nicht gespeichert — er muss der Stufe
     folgen, ohne dass jemand ihn nachträgt. */
  await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Level');
    dt.nextElementSibling.click();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const i = document.querySelector('.fld dd.editing input');
    i.value = '9';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(400);
  const nachStufe = await p.evaluate(() => {
    const o = {};
    document.querySelectorAll('.fld').forEach((f) => { o[f.querySelector('dt').textContent] = f.querySelector('dd').textContent; });
    return { level: o.Level, prof: o.Proficiency };
  });
  pruefe('the derived proficiency follows the level',
    nachStufe.level === '9' && nachStufe.prof === '+4', nachStufe);

  /* Eine Kante, die an einem abstrakten Elternteil hängt, muss jeden Subtyp
     erreichen. Exakt zu vergleichen hiesse: sie erreicht keinen. */
  const session = await neuerArtikel('Session', 'Probe session');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /\+ Relation/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const kanten = await p.evaluate(() =>
    [...[...document.querySelectorAll('.dlgbox select')][0].options].map((o) => o.textContent));
  await p.evaluate(() => {
    const s = [...document.querySelectorAll('.dlgbox select')][0];
    [...s.options].forEach((o) => { if (/part of/.test(o.textContent)) s.value = o.value; });
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  const ziele = await p.evaluate(() =>
    [...[...document.querySelectorAll('.dlgbox select')][1].options].map((o) => o.textContent));
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);
  pruefe('an edge on an abstract parent reaches its subtypes',
    kanten.some((k) => /follows/.test(k)) && kanten.some((k) => /happens at/.test(k)),
    { session: session.typ, kanten });
  pruefe('and its targets resolve through inheritance too',
    ziele.some((z) => /Campaign/.test(z)), ziele.slice(0, 5));

  pruefe('stage B needed no code for its types', errs.length === 0, errs);

  /* ---- A6: Wissen ----
     Die Information ist ein eigener Artikel. Geprüft wird die ganze Kette:
     anlegen, ein Feld zuteilen, einen Empfänger setzen — und dass das Feld
     danach nicht mehr in der offenen Gruppe steht. */
  /* Der Empfänger ist eine **Gruppe** — eine von vieren, die es sein
     dürfen (Creature, Party, Faction, Group). Ein eigener „Wissensstand"
     war ein zweiter Weg zu derselben Frage und ist weg. */
  await neuerArtikel('Group', 'Probe lore');
  await oeffne('Probe hero');
  await p.waitForTimeout(350);

  /* Zugeteilt wird im Seitenpanel — dort, wo die Arbeit passiert. Die
     Gruppierung als eigene Ansicht ist weg: sie zeichnete dieselben
     Feldzellen wie die Feldtabelle, und zweimal dasselbe ist keine
     Gruppierung. */
  await p.evaluate(() =>
    [...document.querySelectorAll('#aside .ktabs button')].find((b) => /Knowledge/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  const wOffen = await p.evaluate(() => ({
    hinweis: document.querySelector('#aside .hint')?.textContent ?? '',
    felder: [...document.querySelectorAll('#aside .kpick label span')].map((x) => x.textContent),
  }));
  pruefe('an article with nothing guarded says so, and the panel is empty',
    /open/.test(wOffen.hinweis) && wOffen.felder.length === 0, wOffen);

  await p.evaluate(() =>
    [...document.querySelectorAll('#aside h3 button')].find((b) => b.textContent === '+').click());
  await p.waitForTimeout(250);
  await p.evaluate(() => { [...document.querySelectorAll('.dlgbox input')][0].value = 'Probe secret'; });
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Create/.test(b.textContent)).click());
  await p.waitForTimeout(500);

  const wAngelegt = await p.evaluate(() => ({
    gewaehlt: [...(document.querySelector('#aside select.i')?.options ?? [])].map((o) => o.textContent),
    auswahl: [...document.querySelectorAll('#aside .kpick label span')].map((x) => x.textContent),
  }));
  pruefe('a new information offers the fields of this article',
    wAngelegt.gewaehlt.includes('Probe secret')
      && wAngelegt.auswahl.some((x) => /Level/.test(x)), wAngelegt);

  await p.evaluate(() => {
    const lab = [...document.querySelectorAll('#aside .kpick label')]
      .find((l) => /Level/.test(l.textContent));
    const cb = lab.querySelector('input');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(500);

  /* Der eigentliche Prüfstein, und er hängt nicht an einer Darstellung:
     **wer die Information nicht hat, sieht das Feld nicht.** Genau dafür
     gibt es die Zuteilung; alles andere daran ist Anzeige. */
  const wZugeteilt = await p.evaluate(() => {
    const T = window.__T__;
    const held = [...T.ENT.values()].find((e) => (e.name || '') === 'Probe hero');
    const info = [...T.ENT.values()].find((e) => (e.name || '') === 'Probe secret');
    const alsGm = T.visibleRefs(held, ['PlayerCharacter.level']);
    T.UI.asActor = 'pc_sela';
    const alsSpieler = T.visibleRefs(held, ['PlayerCharacter.level']);
    T.UI.asActor = '';
    return {
      gespeichert: (info.components.Information || {}).fields ?? [],
      alsGm: alsGm.length,
      alsSpieler: alsSpieler.length,
    };
  });
  pruefe('an assigned field is stored on the information',
    wZugeteilt.gespeichert.includes('PlayerCharacter.level'), wZugeteilt);
  pruefe('and whoever does not have it does not see it',
    wZugeteilt.alsGm === 1 && wZugeteilt.alsSpieler === 0, wZugeteilt);

  await p.evaluate(() => {
    const sel = [...document.querySelectorAll('#aside select.i')]
      .find((s) => [...s.options].some((o) => /assign to/.test(o.textContent)));
    const hit = [...sel.options].find((o) => /Probe lore/.test(o.textContent));
    sel.value = hit.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(500);

  const wEmpfaenger = await p.evaluate(() => ({
    panel: [...document.querySelectorAll('#aside .rel .relrow .rv')].map((x) => x.textContent),
  }));
  pruefe('the recipient shows in the panel',
    wEmpfaenger.panel.some((x) => /Probe lore/.test(x)), wEmpfaenger);

  /* ---- Ein Bündel ----
     Eine Information einzeln zuzuteilen ist die eine Hälfte; die andere
     ist, mehrere als Ganzes zu übergeben. Ein Bündel ist ein Artikel wie
     die Information und trägt dieselbe `knownBy`-Kante — wer es kennt,
     kennt alles darin, ohne dass jemand die Zuteilungen einzeln nachzieht.

     Vorher stand an der Stelle ein *Wissensstand*, dem Figuren über
     `atLevel` angehörten: ein zweiter Weg zu derselben Frage, obwohl Party
     und Group schon Empfänger sein konnten. Kein Artikel, keine Kante, in
     zwei Jahren. */
  const buendel = await p.evaluate(() => {
    const T = window.__T__;
    const info = [...T.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Information');
    const wer = [...T.ENT.values()].find((e) => (e.interfaces || [])[0] === 'PlayerCharacter');
    if (!info || !wer) return { fehlt: true };
    /* Niemand kennt sie einzeln. */
    const vorher = T.knowsInfo(info, wer.id);
    const b = {
      id: 'k_probe', interfaces: ['Knowledge'], name: 'Was man in der Gasse weiss',
      components: { Identity: { name: 'Was man in der Gasse weiss', id: 'knowledge-9999', aliases: [] },
                    Status: { status: 'used' } },
      adhoc: [],
      relations: [
        { id: 'kb1', type: 'includes', to: info.id },
        { id: 'kb2', type: 'knownBy', to: wer.id },
      ],
      createdAt: new Date().toISOString(),
    };
    T.ENT.set(b.id, b);
    const antwort = {
      vorher,
      nachher: T.knowsInfo(info, wer.id),
      drin: T.informationsIn(b).map((i) => i.id),
      rueck: T.bundlesWith(info.id).map((x) => x.id),
      /* Und jemand anderes kennt sie deshalb nicht. */
      fremd: T.knowsInfo(info, 'gibt-es-nicht'),
    };
    T.ENT.delete(b.id);
    return antwort;
  });
  pruefe('a bundle hands over every information in it',
    !buendel.fehlt && buendel.vorher === false && buendel.nachher === true, buendel);
  pruefe('and says what is in it, from both ends',
    buendel.drin && buendel.drin.length === 1 && buendel.rueck.join() === 'k_probe', buendel);
  pruefe('while everyone else still knows nothing', buendel.fremd === false, buendel);

  /* ---- C1/C2: Assets, Einstellungen ----
     Der Auflöser ist die einzige Stelle, die weiss, welche Sorte Verweis ein
     Bild trägt. Geht er falsch, zeigt die Seite ein kaputtes Bild und sagt
     nicht, warum — deshalb gegen alle drei Formen geprüft. */
  const quellen = await p.evaluate(() => {
    const T = window.__T__;
    const asset = [...T.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Asset');
    return {
      leer: T.assetSrc(''),
      fremd: T.assetSrc('https://example.invalid/a.png'),
      ablage: T.assetSrc('0123456789abcdef0123456789abcdef'),
      wurzel: T.assetSrc('/_blob/x'),
      artikel: asset ? T.assetSrc(asset.id) : '(kein Asset-Artikel)',
    };
  });
  pruefe('the asset resolver knows its three kinds of reference',
    quellen.leer === '' && quellen.fremd === 'https://example.invalid/a.png'
      && quellen.ablage === '/_blob/0123456789abcdef0123456789abcdef'
      && quellen.wurzel === '/_blob/x', quellen);

  await zumRegister(p, 'Settings');
  const einst = await p.evaluate(() => ({
    zeilen: [...document.querySelectorAll('.regbody .crow .cl b')].map((x) => x.textContent),
    bekannt: [...(document.querySelectorAll('.addbar select.i')[0]?.options ?? [])].map((o) => o.value),
  }));
  pruefe('campaign settings are a form of their own',
    einst.zeilen.includes('gridSize') && einst.zeilen.includes('inventoryCols'), einst.zeilen);

  /* Ein Bildfeld bietet die Ablage an, wenn es eine gibt, und sonst die
     fremde Adresse — es verschwindet nie stillschweigend. */
  /* Die Bildangaben bringt `Image` mit; worauf ein Verweis zeigt, erklärt
     `Asset`. Beides sind Bestandteile, seit `Base` zerfallen ist. */
  await zumFeld('Asset', null);
  const bildfeld = await p.evaluate(() => {
    const arten = [...document.querySelectorAll('.fbox .frow select')]
      .map((s2) => [...s2.options].map((o) => o.value));
    return { hatAsset: arten.some((a) => a.includes('asset')),
      felder: [...document.querySelectorAll('.fbox .frow .fk')].map((x) => x.textContent) };
  });
  pruefe('a field can be an image reference',
    bildfeld.hatAsset && bildfeld.felder.some((f) => /^ref\b/.test(f)), bildfeld);

  /* ---- Karten (REQ-130 bis 136) ----
     Koordinaten stehen in Anteilen, nicht in Bildpunkten. Prüfbar ist das
     daran, dass die Prozentwerte am Token stehen und nicht Pixel — sonst
     wandert jeder Marker, sobald das Bild ersetzt wird. */
  /* Eine Karte mit Tokens *und* einer Unterkarte — sonst prüft der Lauf die
     Verschachtelung an einer Karte, die gar keine hat, und meldet einen
     Fehler über die Daten statt über den Code. */
  const karte = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const kinder = new Set(alle.flatMap((e) =>
      (e.relations || []).filter((r) => r.type === 'insideMap').map((r) => r.to)));
    const hatToken = (e) => (e.relations || []).some((r) => r.type === 'marker');
    const karten = alle.filter((e) => (e.interfaces || [])[0] === 'Map' && hatToken(e));
    const m = karten.find((e) => kinder.has(e.id)) || karten[0];
    return m ? m.id : null;
  });
  if (karte) {
    const kartenName = await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      return (e && (e.name || (e.components.Imported || {}).text)) || '';
    }, karte);
    await oeffne(kartenName);
    await p.waitForTimeout(250);
    await p.waitForTimeout(400);
    const mk = await p.evaluate(() => ({
      bild: document.querySelector('.mapimg')?.getAttribute('src') ?? null,
      gitter: !!document.querySelector('.mgrid'),
      tokens: [...document.querySelectorAll('.mtoken')].map((t) => ({
        k: t.className, l: t.style.left, o: t.style.top })),
      bereiche: [...document.querySelectorAll('.maparea')].map((a) => a.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the map renders its image and grid', !!mk.bild && mk.gitter, mk.bild);
    pruefe('tokens sit at fractions of the image, not pixels',
      mk.tokens.length > 0 && mk.tokens.every((t) => /%$/.test(t.l) && /%$/.test(t.o)), mk.tokens);
    pruefe('a play token is told apart from a prepared one',
      mk.tokens.some((t) => /k-play/.test(t.k)) && mk.tokens.some((t) => /k-static/.test(t.k)),
      mk.tokens.map((t) => t.k));
    pruefe('the map validates clean', mk.probleme.length === 0, mk.probleme);

    /* Der Tokenfilter: eine vorbereitete Karte und eine laufende sind
       dieselbe Karte, und man will die Vorbereitung ohne die Spielzüge sehen. */
    await p.evaluate(() => {
      const s = [...document.querySelectorAll('.maptools select')][0];
      s.value = 'play';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(300);
    const nurSpiel = await p.evaluate(() =>
      [...document.querySelectorAll('.mtoken')].map((t) => t.className));
    pruefe('the token filter keeps only its kind',
      nurSpiel.length > 0 && nurSpiel.every((c) => /k-play/.test(c)), nurSpiel);
    await p.evaluate(() => {
      const s = [...document.querySelectorAll('.maptools select')][0];
      s.value = '';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(200);
    pruefe('a sub-map shows as a region to zoom into', mk.bereiche.length > 0, mk.bereiche);

    /* ---- Ein Token gehoert der Karte und nicht der Buehne ----
       Alles in Kartenkoordinaten steht in Prozent von `.mapinner`, also
       muss `.mapinner` genau so gross sein wie das Bild. Der Kasten lag
       einmal fest auf Buehnenbreite, waehrend das Bild darin wuchs: ein
       Token bei 50 % sass danach in der Mitte der *Buehne* statt in der
       Mitte der Karte und wanderte beim Zoomen. Geprueft wird darum die
       Stelle auf dem Bild und nicht der Prozentwert im Stil. */
    const haltung = await p.evaluate(async () => {
      const stelle = () => {
        const t = document.querySelector('.mtoken');
        const bild = document.querySelector('.mapimg') || document.querySelector('.mapinner');
        if (!t || !bild) return null;
        const a = t.getBoundingClientRect(), b = bild.getBoundingClientRect();
        if (!b.width || !b.height) return null;
        return { x: (a.left + a.width / 2 - b.left) / b.width,
          y: (a.top + a.height / 2 - b.top) / b.height };
      };
      const vorher = stelle();
      const stage = document.querySelector('.mapstage');
      for (let i = 0; i < 2; i++) {
        stage.dispatchEvent(new WheelEvent('wheel',
          { deltaY: -100, bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 120));
      }
      const nachher = stelle();
      const zoom = window.__T__.UI.mapZoom;
      window.__T__.UI.mapZoom = 1;
      window.__T__.render();
      return { vorher, nachher, zoom };
    });
    await p.waitForTimeout(200);
    pruefe('a token keeps its spot on the map while zooming',
      !!haltung.vorher && !!haltung.nachher && haltung.zoom > 1
      && Math.abs(haltung.vorher.x - haltung.nachher.x) < 0.01
      && Math.abs(haltung.vorher.y - haltung.nachher.y) < 0.01, haltung);

    /* ---- Hineinzoomen statt hineinspringen (REQ-131, 160) ----
       Das Rad zoomt, und wenn ein Unterkartenrahmen den Blick füllt, ist
       der nächste Schritt der Schritt hinein. Eine Schwelle allein wäre
       ein Sprung, den niemand kommen sieht — geprüft wird deshalb beides:
       dass der Rahmen es vorher ansagt, und dass er erst danach betritt. */
    const zoomStufen = await p.evaluate(async () => {
      const stage = document.querySelector('.mapstage');
      const raus = [];
      for (let i = 0; i < 12; i++) {
        stage.dispatchEvent(new WheelEvent('wheel',
          { deltaY: -100, bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 90));
        const nah = document.querySelector('.maparea.near');
        raus.push({
          zoom: window.__T__.UI.mapZoom,
          nah: !!nah,
          sagt: nah ? nah.textContent : '',
          /* Sobald eine andere Karte offen ist, ist der Schritt getan. */
          route: window.__T__.UI.route.id || '',
        });
        if (!document.querySelector('.mapstage')) break;
      }
      return raus;
    });
    const angesagt = zoomStufen.findIndex((x) => x.nah);
    const drin = zoomStufen.findIndex((x, i) =>
      i > 0 && x.route !== zoomStufen[0].route);
    pruefe('the wheel zooms the map in',
      zoomStufen.length > 1 && zoomStufen[1].zoom > zoomStufen[0].zoom, zoomStufen[0]);
    pruefe('a frame that fills the view says so before it is entered',
      angesagt >= 0 && /zoom in to enter/.test(zoomStufen[angesagt].sagt),
      zoomStufen[angesagt]);
    pruefe('and the next step in is the step into it',
      drin > angesagt && angesagt >= 0, { angesagt, drin });

    /* Und zurück: wer ganz hinauszoomt, landet auf der Karte darüber. Ohne
       das wäre das Hineinzoomen eine Einbahnstrasse. */
    const zurueck = await p.evaluate(async () => {
      const T = window.__T__;
      const drinId = T.UI.route.id;
      for (let i = 0; i < 12; i++) {
        const stage = document.querySelector('.mapstage');
        if (!stage) break;
        stage.dispatchEvent(new WheelEvent('wheel',
          { deltaY: 100, bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 90));
        if (T.UI.route.id !== drinId) return { raus: true, id: T.UI.route.id };
      }
      return { raus: false, id: T.UI.route.id };
    });
    pruefe('zooming all the way out goes up to the map above',
      zurueck.raus === true, zurueck);

    /* ---- Einen Rahmen verschieben ----
       Ein Rahmen, den man nur neu aufziehen kann, wird beim ersten Vertun
       neu aufgezogen — und die Unterkarte hängt danach zweimal. Geprüft
       wird über `applyMapTool`, also über denselben Weg, den ein Zug auf
       der Karte nimmt. */
    await oeffne(kartenName);
    await p.waitForTimeout(400);
    const rahmen = await p.evaluate((id) => {
      const T = window.__T__;
      const e = T.ENT.get(id);
      const kind = [...T.ENT.values()].find((o) =>
        (o.relations || []).some((r) => r.type === 'insideMap' && r.to === id));
      const rel = kind.relations.find((r) => r.type === 'insideMap');
      rel.props = { x: 0.2, y: 0.2, w: 0.2, h: 0.2 };
      const mitte = { x: 0.3, y: 0.3 };
      const ecke = { x: 0.4, y: 0.4 };
      T.UI.mapTool = 'area';
      /* Aus der Mitte heraus: der Rahmen wandert mit. */
      T.applyMapTool(e, (e.components || {}).Map || {}, mitte, { x: 0.5, y: 0.45 });
      const nachZug = Object.assign({}, kind.relations.find((r) => r.type === 'insideMap').props);
      /* An der Ecke: er wird grösser, ohne den Ursprung zu bewegen. */
      const r2 = kind.relations.find((r) => r.type === 'insideMap');
      const jetzt = { x: r2.props.x + r2.props.w, y: r2.props.y + r2.props.h };
      T.applyMapTool(e, (e.components || {}).Map || {}, jetzt,
        { x: jetzt.x + 0.15, y: jetzt.y + 0.15 });
      const nachEcke = Object.assign({}, kind.relations.find((r) => r.type === 'insideMap').props);
      /* Und daneben: das legt einen neuen an, nicht diesen um. Der Dialog
         wird gleich wieder weggeklickt. */
      T.UI.mapTool = '';
      return { nachZug, nachEcke, ecke, kind: kind.id,
        anzahl: [...T.ENT.values()].filter((o) =>
          (o.relations || []).some((r) => r.type === 'insideMap' && r.to === id)).length };
    }, karte);
    await p.waitForTimeout(300);
    pruefe('dragging inside a frame moves it, it does not make a new one',
      Math.abs(rahmen.nachZug.x - 0.4) < 0.001 && Math.abs(rahmen.nachZug.y - 0.35) < 0.001
      && Math.abs(rahmen.nachZug.w - 0.2) < 0.001, rahmen.nachZug);
    pruefe('dragging its corner resizes it without moving its origin',
      Math.abs(rahmen.nachEcke.x - rahmen.nachZug.x) < 0.001
      && rahmen.nachEcke.w > rahmen.nachZug.w, rahmen.nachEcke);

    /* ---- Möbel statt Tokens ----
       Ein Möbel liegt auf der Karte, statt auf ihr zu stehen: kein Kreis,
       eine Drehung, und ein Seitenverhältnis, weil ein Tisch kein Quadrat
       ist. Alles drei an der Kante — dasselbe Fass steht auf der nächsten
       Karte längs. */
    await oeffne(kartenName);
    await p.waitForTimeout(400);
    const moebel = await p.evaluate((id) => {
      const T = window.__T__;
      const e = T.ENT.get(id);
      const tok = (e.relations || []).find((r) => r.type === 'marker');
      const merk = Object.assign({}, tok.props);
      tok.props = Object.assign({}, merk,
        { kind: 'scenery', rot: 30, ratio: 0.5, size: 2 });
      T.render();
      return { id: tok.id, merk };
    }, karte);
    await p.waitForTimeout(400);
    const gezeichnet = await p.evaluate(() => {
      const t = document.querySelector('.mtoken.asset');
      if (!t) return null;
      return { klasse: t.className, dreh: t.style.transform,
        breit: t.style.width, hoch: t.style.height };
    });
    pruefe('scenery is drawn as a rotated image, not as a round token',
      !!gezeichnet && /rotate\(30deg\)/.test(gezeichnet.dreh)
      && /translate\(-50%,\s*-50%\)/.test(gezeichnet.dreh), gezeichnet);
    pruefe('and it may be a rectangle — a table is not a square',
      !!gezeichnet && parseFloat(gezeichnet.hoch) < parseFloat(gezeichnet.breit) * 0.6,
      gezeichnet);
    await p.evaluate((x) => {
      const T = window.__T__;
      const e = T.ENT.get(x.karte);
      const tok = (e.relations || []).find((r) => r.id === x.id);
      tok.props = x.merk;
      T.render();
    }, { karte, id: moebel.id, merk: moebel.merk });
    await p.waitForTimeout(300);
  } else {
    pruefe('a map with tokens exists in the data', false, 'keine Karte gefunden');
  }

  /* ---- Nebel, Licht und Sicht, Gebiete (REQ-138, 139, 140, 193) ----
     Drei Dinge, die zusammen eine Falle sind: Nebel wird gespeichert, Licht
     nie, und Gebiete zeigen auf einen Artikel. Was hier schiefgeht, geht
     leise schief — eine Karte, die zu viel zeigt, sieht aus wie eine Karte. */
  const nebelKarte = await p.evaluate(() => {
    const m = [...window.__T__.ENT.values()].find((e) =>
      ((e.components || {}).Map || {}).fog
      && ((e.components || {}).Map || {}).walls);
    return m ? m.id : null;
  });
  if (nebelKarte) {
    await oeffneId(nebelKarte);
    await p.waitForTimeout(600);

    const sicht = await p.evaluate(() => {
      const svg = document.querySelector('.mvis');
      const fog = document.querySelector('.mvis .mfog');
      const masken = [...document.querySelectorAll('.mvis mask')];
      return {
        svg: !!svg,
        viewBox: svg ? svg.getAttribute('viewBox') : '',
        fogDeckung: fog ? fog.getAttribute('fill-opacity') : null,
        /* Die Maske des Nebels: ein weisses Rechteck plus je eine schwarze
           Form je aufgedecktem Stück. */
        fogLoecher: masken.length
          ? [...masken[masken.length - 1].children].filter(
              (n) => n.getAttribute('fill') === '#000').length
          : 0,
        lichtpolygone: [...document.querySelectorAll('.mvis mask polygon')].length,
        waende: document.querySelectorAll('.mvis .mwall').length,
        gebietsfelder: [...document.querySelectorAll('.mvis .mterr')]
          .map((g) => g.children.length),
        flach: !!document.querySelector('.mfogflat'),
      };
    });
    pruefe('the map draws a vision overlay in square units',
      sicht.svg && /^0 0 1 [\d.]+$/.test(sicht.viewBox), sicht.viewBox);
    pruefe('fog is punched through where the party has been',
      sicht.fogLoecher >= 2, sicht.fogLoecher);
    pruefe('each light carves its own visible shape out of the dark',
      sicht.lichtpolygone >= 4, sicht.lichtpolygone);
    pruefe('the GM sees through the fog, but sees that it is there',
      sicht.fogDeckung !== null && Number(sicht.fogDeckung) > 0 && Number(sicht.fogDeckung) < 1,
      sicht.fogDeckung);
    pruefe('sight blockers are drawn for whoever set them', sicht.waende >= 4, sicht.waende);
    pruefe('a territory is rasterised onto the grid, not drawn as one blob',
      sicht.gebietsfelder.some((n) => n > 4), sicht.gebietsfelder);
    pruefe('nothing falls back to the flat cover once the image is measured',
      sicht.flach === false, sicht.flach);

    /* Die Geometrie selbst. Ein Schatten, der im Bild ungefähr stimmt, ist
       am Tisch eine Behauptung — hier wird er gerechnet und nachgemessen. */
    const geo = await p.evaluate(() => {
      const wand = [{ id: 'w', x1: 0.6, y1: 0.2, x2: 0.6, y2: 0.8 }];
      const weit = (pts, ax, ay) => Math.max(...pts
        .filter((q) => Math.abs(Math.atan2(q[1] - ay, q[0] - ax)) < 0.2)
        .map((q) => Math.hypot(q[0] - ax, q[1] - ay)));
      const ohne = window.__T__.visionPoly(0.3, 0.5, 0.5, []);
      const mit = window.__T__.visionPoly(0.3, 0.5, 0.5, wand);
      return {
        ohne: weit(ohne, 0.3, 0.5),
        mit: weit(mit, 0.3, 0.5),
        /* Hinter der Wand ist nichts, davor alles: ein Strahl nach links
           läuft bis zum Radius, einer nach rechts endet an der Wand. */
        links: window.__T__.rayHit(0.3, 0.5, -1, 0, wand, 0.5),
        rechts: window.__T__.rayHit(0.3, 0.5, 1, 0, wand, 0.5),
        drin: window.__T__.inShape({ kind: 'circle', x: 0.5, y: 0.5, r: 0.1 }, 0.52, 0.5),
        draussen: window.__T__.inShape({ kind: 'circle', x: 0.5, y: 0.5, r: 0.1 }, 0.7, 0.5),
      };
    });
    pruefe('a ray stops at the wall in front and runs free behind',
      Math.abs(geo.rechts - 0.3) < 0.01 && Math.abs(geo.links - 0.5) < 0.01, geo);
    pruefe('a wall shortens the visible shape towards it',
      geo.mit < geo.ohne - 0.1, geo);
    pruefe('a point inside a circle is inside and one outside is not',
      geo.drin === true && geo.draussen === false, geo);

    /* Daylight schaltet die Dunkelheit ab — nicht die Lichter aus. */
    await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      e.components.Map.lighting = 'bright';
    }, nebelKarte);
    await p.evaluate(() => window.__T__.render());
    await p.waitForTimeout(400);
    const hell = await p.evaluate(() => ({
      polygone: document.querySelectorAll('.mvis mask polygon').length,
      fog: !!document.querySelector('.mvis .mfog'),
      waende: document.querySelectorAll('.mvis .mwall').length,
    }));
    pruefe('daylight takes the darkness away and leaves the fog',
      hell.polygone === 0 && hell.fog === true, hell);
    /* Wer eine Battlemap baut, baut sie am hellen Tag. Wären die Sperren
       nur im Dunkeln zu sehen, müsste man zum Bauen das Licht ausmachen. */
    pruefe('barriers stay visible to the builder in daylight',
      hell.waende >= 4, hell.waende);

    /* ---- Sperren: Wand, Tür, Fenster, Abgrund ----
       Eine Liste, zwei Fragen. Was hier durcheinanderkommt, kommt leise
       durcheinander: ein Fenster, das den Blick hält, macht den Raum
       dahinter dunkel, und niemand sieht dem Bild an, warum. */
    const sperren = await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      const c = e.components.Map;
      const alt = c.walls;
      c.walls = [
        { id: 'tw', kind: 'wall', x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.9 },
        { id: 'tf', kind: 'window', x1: 0.3, y1: 0.1, x2: 0.3, y2: 0.9 },
        { id: 'ta', kind: 'chasm', x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.9 },
        { id: 'tz', kind: 'door', x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.9, open: false },
        { id: 'to', kind: 'door', x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.9, open: true },
        /* Ohne Art: was vor den Sorten gezeichnet wurde, bleibt eine Wand. */
        { id: 'tx', x1: 0.95, y1: 0.1, x2: 0.95, y2: 0.9 },
      ];
      const r = {
        sicht: window.__T__.mapWalls(c, 1).map((w) => w.id).sort().join(),
        schritt: window.__T__.mapBarriers(c, 1).map((w) => w.id).sort().join(),
      };
      c.walls = alt;
      return r;
    }, nebelKarte);
    pruefe('a window and a chasm stop the step, not the look',
      sperren.sicht === 'tw,tx,tz', sperren);
    pruefe('an open door stops neither, a closed one stops both',
      sperren.schritt === 'ta,tf,tw,tx,tz', sperren);

    /* ---- Zeichenebenen ----
       Nicht die Inhaltsebenen des Stapels — Bilder übereinander auf einer
       Karte. Dass die beiden dasselbe Wort tragen, ist der Grund, warum
       hier steht, welche gemeint ist. */
    const ebenen = await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      const c = e.components.Map;
      /* Das Bild der Karte steht an `Image.image` und nicht an `Map`: eine
         Karte hat ein Bild wie jeder andere Artikel, und genau dieses ist
         ihr Hintergrund. */
      const bild = window.__T__.mapImage(e);
      c.sheets = [
        { id: 's1', name: 'Terrain', image: bild, opacity: 0.5, visible: true },
        { id: 's2', name: 'Secrets', image: bild, opacity: 1, visible: true, gmOnly: true },
        { id: 's3', name: 'Off', image: bild, opacity: 1, visible: false },
      ];
      window.__T__.render();
      return {
        alle: window.__T__.mapSheets(e, c).map((sh) => sh.name).join(),
        gezeichnet: window.__T__.drawnSheets(e, c).map((sh) => sh.name).join(),
      };
    }, nebelKarte);
    await p.waitForTimeout(400);
    pruefe('the base image is the bottom layer and the sheets sit on it',
      ebenen.alle === 'Base map,Terrain,Secrets,Off', ebenen.alle);
    pruefe('a layer switched off is not drawn',
      ebenen.gezeichnet === 'Base map,Terrain,Secrets', ebenen.gezeichnet);

    const gemalt = await p.evaluate(() => {
      const basis = document.querySelector('.mapinner .mapimg');
      return {
        blaetter: [...document.querySelectorAll('.mapinner .msheet')]
          .map((n) => n.style.opacity).join(),
        basis: basis ? basis.style.opacity : null,
        /* Die Leiste zeigt das unterste Blatt mit, sonst liesse es sich
           nicht ausblenden. Vier Einträge für drei Blätter. */
        zeilen: document.querySelectorAll('.msheetrow').length,
      };
    });
    pruefe('each drawn layer carries its own opacity',
      gemalt.blaetter === '0.5,1', gemalt);
    pruefe('the layer panel lists the base map and every sheet',
      gemalt.zeilen === 4, gemalt.zeilen);

    await p.evaluate((id) => {
      window.__T__.ENT.get(id).components.Map.baseHidden = true;
      window.__T__.render();
    }, nebelKarte);
    await p.waitForTimeout(300);
    const ohneBasis = await p.evaluate(() => {
      const b = document.querySelector('.mapinner .mapimg');
      return b ? b.style.opacity : null;
    });
    /* Ausgeblendet heisst durchsichtig und nicht weg: an dem Bild hängt die
       Grösse der Karte, und eine Karte ohne Grösse hat keine Koordinaten. */
    pruefe('hiding the base image leaves it in place, only invisible',
      ohneBasis === '0', ohneBasis);

    /* Was der Spielleitung gehört, sieht ein Spieler nicht. Hier in der
       Seite, weil die Seite keinen Server hat — im echten Stapel hält
       `redactEntity` es zurück, bevor es losgeschickt wird. */
    const alsSpieler = await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      const c = e.components.Map;
      c.baseHidden = false;
      const vorher = window.__T__.UI.asActor;
      window.__T__.UI.asActor = 'pc_rook';
      const sicht = window.__T__.drawnSheets(e, c).map((sh) => sh.name).join();
      window.__T__.UI.asActor = vorher;
      c.sheets = [];
      window.__T__.render();
      return sicht;
    }, nebelKarte);
    pruefe('a GM-only layer stays with the GM',
      alsSpieler === 'Base map,Terrain', alsSpieler);
    await p.waitForTimeout(300);
    await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      e.components.Map.lighting = 'dark';
    }, nebelKarte);
    await p.evaluate(() => window.__T__.render());
    await p.waitForTimeout(300);
  } else {
    pruefe('a map with fog and walls exists in the data', false, 'keine Nebelkarte gefunden');
  }

  /* ---- Beziehungen (REQ-030, 081) ----
     Eine Kante mit Marken, und sonst nichts. Die Prüfung sucht deshalb
     zuerst nach dem Gegenteil: einem Feld, in dem wieder eine Ruf-Zahl
     liegen könnte, und den Resten der Maschinerie, die hier einmal stand.
     Gäbe es sie, wäre „simpel" nur eine Behauptung.

     `Creature.attitude` ist ausdrücklich keines davon: das ist die
     Grundhaltung gegenüber Fremden, ein Wort und kein Zähler. Sie zeigt auf
     niemanden, also ist sie ein Feld — richtig so. Was auf jemanden zeigt,
     ist die Kante `regards`. Damit die Trennung hält, wird sie hier beides
     geprüft. */
  const rufFeld = await p.evaluate(() => {
    const treffer = [];
    Object.entries(window.__T__.REG.interfaces).forEach(([k, c]) => {
      Object.keys((c.schema || {}).properties || {}).forEach((f) => {
        if (/^(standing|reputation|favour|reknown)$/i.test(f)) treffer.push(k + '.' + f);
      });
    });
    return treffer;
  });
  pruefe('no component stores a standing — a relationship is words, not a score',
    rufFeld.length === 0, rufFeld);
  const haltung = await p.evaluate(() =>
    ((window.__T__.REG.interfaces.Creature.schema.properties || {}).attitude || {}));
  pruefe('the default attitude stays a word about strangers, not a counter',
    haltung.type === 'string' && Array.isArray(haltung.enum), haltung);

  /* Was wegfiel, fiel ganz weg. Eine halb entfernte Mechanik ist schlimmer
     als eine ganze: sie sieht aus, als liefe sie noch. */
  const reste = await p.evaluate(() => ({
    iface: !!window.__T__.REG.interfaces.Deed,
    comp: !!window.__T__.REG.interfaces.DeedInfo,
    kanten: ['doneBy', 'regarding'].filter((k) => !!window.__T__.REG.relations[k]),
    artikel: [...window.__T__.ENT.values()]
      .filter((e) => (e.interfaces || [])[0] === 'Deed').length,
    /* Und keine Kante irgendwo zeigt noch auf einen Artikel, den es nicht
       mehr gibt — eine verwaiste Kante ist genau das, was dieses Modell
       nicht haben will. */
    verwaist: [...window.__T__.ENT.values()].flatMap((e) =>
      (e.relations || []).filter((r) => r.to && !window.__T__.ENT.get(r.to))
        .map((r) => e.id + ' -' + r.type + '-> ' + r.to)),
    props: Object.keys(
      ((window.__T__.REG.relations.regards || {}).props || {}).properties || {}),
  }));
  pruefe('the deeds are gone — interface, component and both edges',
    !reste.iface && !reste.comp && reste.kanten.length === 0 && reste.artikel === 0, reste);
  pruefe('nothing is left pointing at an article that no longer exists',
    reste.verwaist.length === 0, reste.verwaist);
  pruefe('a relationship carries thoughts and a line, and no number',
    reste.props.join() === 'tags,note', reste.props);

  const auge = await p.evaluate(() => {
    const f = [...window.__T__.ENT.values()].find((e) =>
      (e.relations || []).some((r) => r.type === 'regards'));
    return f ? f.id : null;
  });
  if (auge) {
    await oeffneId(auge);
    await p.waitForTimeout(400);
    const lesen = () => p.evaluate(() =>
      [...document.querySelectorAll('.strow')].map((r) => ({
        wer: r.querySelector('.ck .ref')?.textContent ?? '',
        marken: [...r.querySelectorAll('.rtags .pill')].map((t) => t.textContent),
        zurueck: [...r.querySelectorAll('.ck.back .pill')].map((t) => t.textContent),
        warum: r.querySelector('.rnote')?.textContent ?? '',
      })));
    const vorher = await lesen();
    pruefe('a relationship shows who, what they think, and why',
      vorher.length > 0 && vorher.some((r) => r.marken.length > 0 && r.warum),
      vorher);
    /* Die Gegenrichtung (REQ-081): zwei Kanten, zwei Meinungen. Genau da
       wird es interessant — einer ist dankbar, der andere misstraut. */
    pruefe('the other direction is its own edge and may say something else',
      vorher.some((r) => r.zurueck.length > 0
        && r.zurueck.join() !== r.marken.join()),
      vorher.map((r) => ({ hin: r.marken, her: r.zurueck })));

    /* Eine Marke dazu und wieder weg. Beides am Ort, an dem sie steht —
       eine Marke, die man nur über einen Dialog loswird, bleibt stehen. */
    const zahl = await p.evaluate(() => {
      const t = document.querySelector('.rtags .pill.x');
      const vor = document.querySelectorAll('.rtags .pill').length;
      t.click();
      return { vor, nach: document.querySelectorAll('.rtags .pill').length };
    });
    await p.waitForTimeout(300);
    pruefe('clicking a thought takes it off where it stands',
      zahl.nach === zahl.vor - 1, zahl);
    const gespeichert = await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      const r = (e.relations || []).find((x) => x.type === 'regards');
      return r ? (r.props || {}).tags.length : -1;
    }, auge);
    pruefe('and the edge keeps what is left, not a fresh empty one',
      gespeichert >= 1, gespeichert);
  } else {
    pruefe('a relationship exists in the data', false, 'kein regards gefunden');
  }

  /* ---- Beute ----
     Was jemand erfährt, ist genauso ein Fund wie, was er einsteckt. Die
     Prüfung fragt das am Register und nicht an der Maske: die Auswahl im
     Kantendialog entsteht aus `to`, und wenn dort das Falsche steht, hilft
     kein Klick. */
  const beute = await p.evaluate(() => {
    const T = window.__T__;
    const to = T.REG.relations.loot.to || [];
    return {
      anQuest: T.relsFrom('Quest').map((r) => r.type).includes('loot'),
      information: T.ifaceInList(to, 'Information'),
      feat: T.ifaceInList(to, 'Feat'),
      skill: T.ifaceInList(to, 'Skill'),
      /* Eine Waffe ist ein Gegenstand — über `extends`, nicht über einen
         zweiten Eintrag in `to`. */
      weapon: T.ifaceInList(to, 'Weapon'),
      /* Eine Lauernde Aktion ist auch eine Regel und trotzdem keine Beute. */
      rule: T.ifaceInList(to, 'Rule'),
    };
  });
  pruefe('a quest may carry loot, not only an encounter', beute.anQuest === true, beute);
  pruefe('what you learn is loot, and so is a feat or a skill',
    beute.information && beute.feat && beute.skill, beute);
  pruefe('an item subtype gets there through inheritance', beute.weapon === true, beute);
  pruefe('but not every rule is a prize', beute.rule === false, beute);

  /* ---- Der Spieltisch (Bereich Play) ----
     Karte, Initiative und Boards sind keine Artikel, die man nachschlägt —
     sie sind das, worauf man während der Sitzung schaut. Die Prüfung fragt
     deshalb zuerst, ob der Bereich überhaupt an den Tisch führt und nicht
     in eine Liste: genau dort ging es vorher verloren. */
  await zurSeite(p, 'Play');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')]
      .find((x) => /At the table/.test(x.textContent)).click());
  await p.waitForTimeout(700);
  const tisch = await p.evaluate(() => ({
    kopf: document.querySelector('#view .listhead h2')?.textContent ?? '',
    /* Keine Artikelliste: wer hier Zeilen sieht, ist im Kompendium
       gelandet und nicht am Tisch. */
    zeilen: document.querySelectorAll('#view .row').length,
    karte: !!document.querySelector('.playpane .mapbox'),
    kampf: !!document.querySelector('.playpane .fight'),
    reiter: [...document.querySelectorAll('#view .ktabs .btn')].map((b) => b.textContent),
    /* Was läuft, steht an der Sitzung und wird hier nur gezeigt. */
    sitzung: !!document.querySelector('#view .listhead .ref'),
    /* Welche Sitzung der Tisch nimmt — eine leere, eben angelegte darf ihn
       nicht übernehmen. */
    sitzungen: [...window.__T__.ENT.values()]
      .filter((e) => (e.components || {}).Session).map((e) => e.id),
  }));
  pruefe('the play area opens the table, not a list of articles',
    tisch.kopf === 'At the table' && tisch.zeilen === 0, tisch);
  pruefe('the map and the running fight are both on it',
    tisch.karte === true && tisch.kampf === true, tisch);
  pruefe('and it says which session it is drawing from',
    tisch.sitzung === true, tisch);

  /* Die Initiative steht oben und bleibt stehen, wenn man auf die Boards
     umschaltet: wer dran ist, muss man sehen, ohne zurückzuschalten. */
  await p.evaluate(() =>
    [...document.querySelectorAll('#view .ktabs .btn')]
      .find((b) => /Boards/.test(b.textContent)).click());
  await p.waitForTimeout(600);
  const brett = await p.evaluate(() => ({
    board: !!document.querySelector('.playpane .boardbox'),
    kampf: !!document.querySelector('.playpane .fight'),
    /* Nach den Streifen gefragt und nicht nach `.mapbox`: eine Karte kann
       als Karte auf einem Board liegen, und dann ist sie zu Recht da. Was
       hier zählt, ist, welcher Streifen aufgeschlagen ist. */
    streifen: [...document.querySelectorAll('.playpane > .sec > span')]
      .map((x) => x.textContent),
  }));
  pruefe('switching to the boards swaps the map pane, not the initiative',
    brett.board === true && brett.kampf === true
    && brett.streifen.includes('Board') && !brett.streifen.includes('Map'),
    brett);

  /* Und was läuft, kommt aus der Sitzung: nimmt man den Kampf dort heraus,
     ist der Streifen weg — eine zweite Stelle dafür wäre die, an der der
     Beamer etwas anderes zeigt als der Laptop. */
  const ausgeschaltet = await p.evaluate(() => {
    const T = window.__T__;
    const ses = [...T.ENT.values()].find((e) => (e.components || {}).Session);
    const merk = ses.components.Session.activeEncounter;
    ses.components.Session = Object.assign({}, ses.components.Session,
      { activeEncounter: undefined });
    T.render();
    const weg = !document.querySelector('.playpane .fight');
    ses.components.Session.activeEncounter = merk;
    T.render();
    return weg;
  });
  await p.waitForTimeout(400);
  pruefe('what is running comes from the session, not from this screen',
    ausgeschaltet === true, ausgeschaltet);
  await p.evaluate(() =>
    [...document.querySelectorAll('#view .ktabs .btn')]
      .find((b) => /^Map$/.test(b.textContent)).click());
  await p.waitForTimeout(400);
  pruefe('the table raised no exception', errs.length === 0, errs);

  /* ---- Was woanders wohnt, hier bearbeiten ----
     An einer Figur stand ein Verweis „statblock of: Werte von Rook", und
     wer eine Zahl ändern wollte, sprang auf einen zweiten Artikel, änderte
     sie dort und suchte den Weg zurück. Gezeichnet werden jetzt die Felder
     **des anderen Artikels**, mit seinen eigenen Eingaben — und die
     schreiben in ihn und nicht in die Figur. */
  await oeffneId('pc_rook');
  const dran = await p.evaluate(() => {
    const box = document.querySelector('.linkedbox');
    if (!box) return { keineKiste: true };
    return {
      name: box.querySelector('.ref')?.textContent ?? '',
      /* Das Inventar ist ausgenommen: es hat im Reiter „Gear" sein eigenes
         Element, und zweimal dasselbe ist keine Gliederung. */
      kisten: document.querySelectorAll('.linkedbox').length,
      felder: [...box.querySelectorAll('.fld dt')].map((d) => d.textContent),
    };
  });
  pruefe('a linked article stands on the page with its own fields',
    !dran.keineKiste && /Rook/.test(dran.name)
    && dran.felder.includes('Armour class') && dran.felder.includes('Hit points'), dran);

  const dortGeschrieben = await p.evaluate(async () => {
    const T = window.__T__;
    const box = document.querySelector('.linkedbox');
    const dt = [...box.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Armour class');
    dt.nextElementSibling.click();
    await new Promise((r) => setTimeout(r, 250));
    const i = document.querySelector('.linkedbox .fld dd.editing input');
    if (!i) return { keinEingang: true };
    i.value = '17';
    i.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    return {
      /* Der Wert steht im **Statblock**, nicht in der Figur. */
      imStatblock: (T.ENT.get('sb_pc_rook').components.Statblock || {}).ac,
      inDerFigur: (T.ENT.get('pc_rook').components.Statblock || {}).ac,
      geschrieben: window.__WROTE__.filter((x) => /sb_pc_rook/.test(x)).length,
    };
  });
  pruefe('and editing there writes into that article, not into this one',
    dortGeschrieben.imStatblock === 17 && dortGeschrieben.inDerFigur === undefined
    && dortGeschrieben.geschrieben > 0, dortGeschrieben);

  /* ---- Die Artikelarten zum Durchgehen ----
     Dieselbe Übersicht, die der Katalog als Datei schreibt, aber aus dem
     **laufenden** Register. Eine Seite, die eine Liste abtippt, stimmt am
     Tag ihrer Entstehung und danach nie wieder — die Prüfung fragt deshalb
     nicht, ob etwas dasteht, sondern ob es aus dem Register kommt. */
  await zumRegister(p, 'Types');
  const typen = await p.evaluate(() => ({
    kopf: document.querySelector('#view h2')?.textContent ?? '',
    reiter: [...document.querySelectorAll('.tabs button[aria-selected="true"]')].map((x) => x.textContent),
    bereiche: [...document.querySelectorAll('.rail h3')].map((h) => h.textContent),
    arten: document.querySelectorAll('.rail .navrow').length,
    imRegister: Object.keys(window.__T__.REG.interfaces).length,
    abschnitte: [...document.querySelectorAll('.tpdoc .sec')].map((x) => x.textContent),
  }));
  pruefe('the article types open as a part of their own',
    typen.kopf === 'Registry' && typen.reiter.join() === 'Types', typen);
  /* Jede Art aus dem Register steht in der Leiste — keine fehlt, keine ist
     doppelt. Eine Übersicht, die eine Art auslässt, ist schlimmer als keine:
     man hält sie für vollständig. */
  pruefe('every kind in the registry is listed, exactly once',
    typen.arten === typen.imRegister, typen);
  /* **Flach und ohne Überschriften.** Die Liste war nach Bereich gruppiert
     und nach Unterarten eingerückt — beides aus `extends`, und `extends` ist
     ein Array. Ein Baum muss sich für eine Herkunft entscheiden, also stand
     eine Art, die von zweien erbt, unter einer und unter der anderen nicht.
     Wer sie dort suchte, hielt sie für nicht vorhanden. */
  pruefe('the list is flat — no headings that pick one lineage',
    typen.bereiche.join() === 'Types', typen.bereiche);
  const leisteGefiltert = await p.evaluate(async () => {
    const feld = document.querySelector('#rail input[type=search]');
    feld.value = 'quest';
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const namen = [...document.querySelectorAll('.rail .navrow')].map((b) => b.dataset.t);
    const feld2 = document.querySelector('#rail input[type=search]');
    feld2.value = '';
    feld2.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    return { namen, wiederAlle: document.querySelectorAll('.rail .navrow').length };
  });
  pruefe('and a filter narrows it — fifty-nine rows are more than one glance',
    leisteGefiltert.namen.includes('Quest') && leisteGefiltert.namen.length < 5
    && leisteGefiltert.wiederAlle === typen.imRegister, leisteGefiltert);

  /* Eine Art zeigt, woraus sie besteht, was sie festhält, welche Kanten sie
     trägt und wie sie gezeichnet wird — **und jedes davon genau einmal.**
     Es stand einmal alles zweimal da: oben zum Lesen, unten zum Ändern. Wer
     einen Bestandteil entfernen wollte, versuchte es oben, und dort war es
     ein Bild. */
  const eine = await p.evaluate(async () => {
    const T = window.__T__;
    T.UI.typePick = 'PlayerCharacter';
    T.render();
    await new Promise((r) => setTimeout(r, 250));
    const txt = (sel) => [...document.querySelectorAll(sel)].map((x) => x.textContent);
    return {
      titel: document.querySelector('.tpdoc .arthead h2')?.textContent ?? '',
      abschnitte: txt('.tpdoc .sec').concat(txt('.tpdoc .rsec')),
      /* **Die eigenen Felder offen, die geerbten Typen zugeklappt.** Je
         geerbter Typ eine Zeile: Name, woher er kommt, wie viele Felder er
         bringt. Eine Spielerfigur erbt aus siebzehn Typen — flach
         ausgeschrieben sind das achtundvierzig Zeilen, und die eigenen
         sechs gehen darin unter. */
      gruppen: [...document.querySelectorAll('.fbox.part')].map((b) => b.dataset.part),
      zu: [...document.querySelectorAll('.fbox.part .partfields')]
        .filter((f) => f.style.display === 'none').length,
      /* Woher: direkt dazugenommen oder über einen anderen hereingekommen.
         Nur der direkte lässt sich hier herausnehmen. */
      woher: [...document.querySelectorAll('.fbox.part .fhead')]
        .map((h) => (h.querySelector('.ref')?.dataset.from ?? '') + '='
          + (/via /.test(h.textContent) ? 'via' : 'direct')),
      rausnehmbar: [...document.querySelectorAll('.fbox.part .fhead')]
        .filter((h) => h.querySelector('button.dngr'))
        .map((h) => h.querySelector('.ref')?.dataset.from),
      /* Und ein ganzer Typ dazu — an derselben Stelle wie ein Feld dazu. */
      teilDazu: [...document.querySelectorAll('.tpdoc .addbar select option')]
        .some((o) => /\+ type/.test(o.textContent)),
      inh: document.querySelectorAll('.fbox .frow.inh').length,
      kantenRaus: document.querySelectorAll('.tedges').length,
      reiter: txt('.tmpltab'),
    };
  });
  pruefe('a kind shows what it records, connects and looks like',
    eine.titel === 'Player character'
    && eine.abschnitte.some((x) => /^Fields/.test(x))
    && eine.abschnitte.some((x) => /^Edges from here/.test(x))
    && eine.abschnitte.some((x) => /^Views/.test(x)), eine.abschnitte);
  /* **Ein Bereich und nicht zwei.** „Made of" gibt es nicht mehr: der
     Bestandteil steht als Kopfzeile über seinen Feldern. */
  pruefe('and the parts are not a second list next to the fields',
    !eine.abschnitte.some((x) => /^Made of/.test(x)), eine.abschnitte);
  /* Jede Frage einmal. Eine Seite, die alles zweimal zeigt, hat eine Hälfte,
     die nur so aussieht, als könnte man sie bedienen. */
  pruefe('and says each of them exactly once',
    eine.abschnitte.length === new Set(eine.abschnitte).size, eine.abschnitte);
  pruefe('the inherited types stand as their own groups, closed',
    eine.gruppen.includes('Creature') && eine.gruppen.includes('Identity')
    && eine.zu === eine.gruppen.length, { gruppen: eine.gruppen.length, zu: eine.zu });
  /* `Creature` ist direkt dazugenommen, `Identity` kommt über `Creature`
     herein — und nur der direkte lässt sich hier herausnehmen. */
  pruefe('and each says whether it was taken in here or came in through another',
    eine.woher.includes('Creature=direct') && eine.woher.includes('Identity=via')
    && eine.rausnehmbar.includes('Creature') && !eine.rausnehmbar.includes('Identity')
    && eine.teilDazu, { woher: eine.woher.slice(0, 4), rausnehmbar: eine.rausnehmbar });
  pruefe('and every inherited field is there, once, ready to be opened',
    eine.inh > 20, { inh: eine.inh });
  /* **Was über eine Kante hängt, steht als Gruppe mit dabei.**
     Der Statblock einer Kreatur ist ein eigener Artikel — austauschbar,
     wiederverwendbar —, und seine Felder gehören trotzdem zu dem, was an
     einer Kreatur dransteht. Wer im Register wissen will, was eine
     Kreatur trägt, will `ac` und `hp` sehen und nicht „es gibt da eine
     Kante". Die Marke sagt, dass die Werte **nicht** in der Karte dieser
     Art stehen. */
  const verlinkt = await p.evaluate(() => {
    const kasten = [...document.querySelectorAll('.fbox.part.linked')];
    return kasten.map((b) => ({
      typ: b.dataset.linked,
      marke: b.querySelector('.pill')?.textContent ?? '',
      zu: b.querySelector('.partfields').style.display === 'none',
      felder: [...b.querySelectorAll('.frow .fk')].map((x) => x.textContent.split(' ')[0]),
    }));
  });
  const sbGruppe = verlinkt.find((x) => x.typ === 'Statblock');
  /* Auf `hp` zu prüfen ginge schief: weiter oben hat der Lauf es zu
     `hitPoints` umbenannt, und eine Prüfung, die von der Spur einer
     anderen lebt, prüft am Ende nur noch sich selbst. */
  pruefe('a type that hangs on an edge stands there with its fields',
    !!sbGruppe && /linked · belongsTo/.test(sbGruppe.marke) && sbGruppe.zu
    && sbGruppe.felder.includes('ac') && sbGruppe.felder.length > 10, verlinkt);
  /* Und das Inventar genauso — dieselbe Sorte Kante, anderes Ende. */
  pruefe('and so does the one at the other end of the edge',
    verlinkt.some((x) => x.typ === 'Inventory' && /linked · carries/.test(x.marke)),
    verlinkt.map((x) => x.typ));

  /* **Aufklappen zeigt die Felder und lässt die Stelle, an der man war.**
     Gezeichnet wird dabei nichts neu: die Zeilen stehen schon im Baum. Ein
     Neuzeichnen setzte jeden Kasten mit eigenem Scroll nach oben, und wer
     unten in einer Feldliste etwas aufklappt, sucht danach die Stelle, an
     der er gerade war. */
  const aufgeklappt = await p.evaluate(async () => {
    const T = window.__T__;
    const kasten = [...document.querySelectorAll('.fbox.part')]
      .find((b) => b.dataset.part === 'Identity');
    const felder = kasten.querySelector('.partfields');
    const roller = document.querySelector('.main');
    roller.scrollTop = 180;
    const vorher = { zu: felder.style.display === 'none', y: roller.scrollTop };
    kasten.querySelector('.fhead.klapp').click();
    await new Promise((r) => setTimeout(r, 200));
    return {
      vorher,
      offenJetzt: kasten.querySelector('.partfields').style.display !== 'none',
      y: document.querySelector('.main').scrollTop,
      gemerkt: !!(T.UI.regOpen || {})['PlayerCharacter::Identity'],
      zeilen: kasten.querySelectorAll('.frow.inh').length,
    };
  });
  pruefe('opening an inherited type shows its fields and remembers it',
    aufgeklappt.vorher.zu && aufgeklappt.offenJetzt && aufgeklappt.gemerkt
    && aufgeklappt.zeilen === 4, aufgeklappt);
  pruefe('and it stays where you were',
    aufgeklappt.y === aufgeklappt.vorher.y, aufgeklappt);

  /* Und ein geerbtes Feld lässt sich **einstellen**: Standard, Werte,
     Pflicht. Geändert wird der Typ, dem es gehört — darum steht es an der
     Kopfzeile der Gruppe und im Titel des Knopfs. Ohne das müsste man den
     Typ aufschlagen, um einen Standard zu setzen. */
  const einstellbar = await p.evaluate(async () => {
    const T = window.__T__;
    const zeile = [...document.querySelectorAll('.fbox.part .frow.inh')]
      .find((r) => r.querySelector('.fk')?.textContent.replace('*', '') === 'aliases');
    const knopf = [...zeile.querySelectorAll('button')]
      .find((b) => b.textContent === '\u22ef');
    if (!knopf) return { keinKnopf: true };
    knopf.click();
    await new Promise((r) => setTimeout(r, 250));
    const panel = document.querySelector('.fbox.part .fmore');
    const raus = {
      regprop: T.UI.regprop,
      felder: [...(panel?.querySelectorAll('label.f span') ?? [])].map((x) => x.textContent),
      /* Die Gruppe bleibt offen — das Zeichnen liest `UI.regOpen`. */
      nochOffen: [...document.querySelectorAll('.fbox.part')]
        .find((b) => b.dataset.part === 'Identity')
        ?.querySelector('.partfields').style.display !== 'none',
    };
    T.UI.regprop = '';
    T.render();
    return raus;
  });
  pruefe('an inherited field can be configured where it stands',
    einstellbar.regprop === 'Identity.aliases'
    && einstellbar.felder.some((x) => /Default/.test(x))
    && einstellbar.nochOffen, einstellbar);

  /* Die Reiter des Bogens stehen in der Vorlage mit Namen — „tabs" allein
     zu lesen sagt nichts. */
  pruefe('the template shows the tabs by name, not just the word “tabs”',
    eine.reiter.includes('Overview') && eine.reiter.includes('Gear'), eine.reiter);

  /* Vor/zurück geht durch dieselbe Reihenfolge wie die Liste links. Eine
     zweite Ordnung daneben wäre die Stelle, an der „nächste" etwas anderes
     heisst als das, was darunter steht. */
  const lauf = await p.evaluate(async () => {
    const T = window.__T__;
    const nav = [...document.querySelectorAll('.rail .navrow b')].map((b) => b.textContent);
    const jetzt = document.querySelector('.rail .navrow.on b')?.textContent ?? '';
    [...document.querySelectorAll('.tpdoc .maptools .btn')]
      .find((b) => b.textContent === '→').click();
    await new Promise((r) => setTimeout(r, 250));
    return { nav, jetzt, danach: document.querySelector('.rail .navrow.on b')?.textContent ?? '' };
  });
  pruefe('forward steps to the next one in the list, not somewhere else',
    lauf.nav.indexOf(lauf.danach) === lauf.nav.indexOf(lauf.jetzt) + 1, lauf);

  /* Und sie ist nichts für Spieler: sie zeigt, was es geben *kann*. */
  const alsSpieler2 = await p.evaluate(async () => {
    const T = window.__T__;
    const vorher = T.UI.asActor;
    T.UI.asActor = 'pc_rook';
    T.render();
    await new Promise((r) => setTimeout(r, 250));
    const zu = !document.querySelector('#pages button[data-p="registry"]')
      && ![...document.querySelectorAll('#pages button')].some((b) => b.textContent === 'Registry');
    T.UI.asActor = vorher;
    T.render();
    return zu;
  });
  await p.waitForTimeout(300);
  pruefe('the type overview stays with the GM', alsSpieler2 === true, alsSpieler2);

  /* ---- Die Vorlage ----
     Artikelarten und Datenmodell sind eine Seite: rechts steht, was die
     gewählte Ansicht von dieser Art zeigt, und ein Klick nimmt ein Feld
     heraus oder legt es zurück. Zwei Seiten hiessen, das Modell hier
     anzulegen und dort nachzusehen, was dabei herauskommt. */
  const vorlage = await p.evaluate(async () => {
    const T = window.__T__;
    T.UI.typePick = 'PlayerCharacter';
    T.UI.typeView = 'full';
    T.render();
    await new Promise((r) => setTimeout(r, 300));
    return {
      elemente: [...document.querySelectorAll('.tmplel > .ck > code')].map((x) => x.textContent),
      reiter: [...document.querySelectorAll('.tmpltab')].map((x) => x.textContent),
      /* **Gewählt wird nach Gruppe.** Vorher stand jedes einzelne Feld als
         Marke da — bei einer Figur achtundvierzig. Eine Übersicht ist drei
         Zeilen lang; wer sie zusammenstellt, sagt „den Statblock nicht". */
      gruppen: document.querySelectorAll('.tmplfields .tgl').length,
      an: document.querySelectorAll('.tmplfields .tgl.on').length,
      /* Was in `full` **aus** ist, ist es nicht aus Versehen: der Bogen
         zeichnet es schon, und die Feldtabelle lässt es über `except` weg. */
      ausWoher: [...document.querySelectorAll('.tmplfields .tgl:not(.on)')]
        .map((x) => x.dataset.comp),
      /* Und in `full` gibt es nichts anzuklicken: sie zeigt alles. */
      zu: [...document.querySelectorAll('.tmplfields .tgl')].every((b) => b.disabled),
      /* Die Maske steht auf derselben Seite darunter — das ist die
         Vereinigung, um die es ging. */
      maske: !!document.querySelector('.tpdoc .regbody'),
    };
  });
  pruefe('the template shows what the view draws for this kind',
    vorlage.elemente.includes('sheet') && vorlage.elemente.includes('tabs')
    && vorlage.reiter.includes('Overview'), vorlage);
  pruefe('and the model editor sits on the same page',
    vorlage.maske === true, vorlage.maske);
  /* `full` zeigt alles — ausser dem, was ein anderes Element derselben
     Seite schon zeichnet. Bei einer Kreatur sind das die Kampfwerte: sie
     stehen im Bogen, und die Feldtabelle lässt sie über `except` weg. Eine
     Prüfung auf „alle an" wäre falsch und würde genau diese Absicht
     beanstanden. */
  pruefe('every group is offered, and what is off is off on purpose',
    vorlage.gruppen > 8 && vorlage.an > 0
    && vorlage.ausWoher.every((c) => ['Vitals', 'Proficiencies'].includes(c)),
    { gruppen: vorlage.gruppen, an: vorlage.an, ausWoher: [...new Set(vorlage.ausWoher)] });
  /* `full` zeigt alles: dort ist nichts abzuwählen. Was fehlt, fehlt, weil
     ein anderer Block derselben Seite es zeichnet — das ist eine Sache der
     Anordnung und keine Wahl je Art. */
  pruefe('and full has nothing to untick, because it shows everything',
    vorlage.zu === true, vorlage.zu);

  /* Ein Klick nimmt ein Feld aus der Ansicht — und ein zweiter legt es
     zurück. Geschrieben wird dabei `except` und keine ausgeschriebene
     Liste: die wäre am Tag der nächsten Registerzeile falsch, und das Neue
     stünde nirgends. */
  const geklickt = await p.evaluate(async () => {
    const T = window.__T__;
    /* Auf `quick` wird gewählt — `full` zeigt alles. Und eine Spielerfigur
       erbt ihre Anordnung von `Creature`: der Weg, den man geht, ist erst
       eine eigene machen, dann ändern. */
    T.UI.typeView = 'quick';
    T.render();
    await new Promise((r) => setTimeout(r, 300));
    const eigenKnopf = [...document.querySelectorAll('.tmpl .maptools .btn')]
      .find((b) => /Give it its own/.test(b.textContent));
    if (eigenKnopf) { eigenKnopf.click(); await new Promise((r) => setTimeout(r, 350)); }
    /* Die Marken der **Feldtabelle** tragen `data-comp` — die der Prosa
       stehen daneben und meinen einzelne Stellen. Auf `quick` ist nichts
       gewählt: eine Karte trägt zwei Werte, und welche, sagt die Art. Also
       wird hier eine Gruppe **dazugenommen**. */
    const erste = () => document.querySelector('.tmplfields .tgl[data-comp]:not(.on):not([disabled])');
    const name = erste()?.dataset.comp ?? '';
    erste().click();
    await new Promise((r) => setTimeout(r, 300));
    const eigen = (T.REG.interfaces.PlayerCharacter.views || {}).quick || [];
    const feldEl = eigen.find((x) => x.el === 'fields')
      || (eigen.find((x) => x.el === 'tabs')?.tabs || [])
        .flatMap((t) => t.layout).find((x) => x.el === 'fields');
    const aus = document.querySelectorAll('.tmplfields .tgl:not(.on)').length;
    const alleAngaben = [].concat(feldEl?.except ?? [],
      Array.isArray(feldEl?.fields) ? feldEl.fields : []);
    return {
      name, aus,
      except: feldEl?.except ?? null,
      fields: feldEl?.fields ?? null,
      /* Steht die Gruppe jetzt da? Entweder weil sie in der Liste steht
         oder weil sie aus `except` heraus ist. */
      sichtbar: !!document.querySelector(`.tmplfields .tgl[data-comp="${name}"]`)
        ?.classList.contains('on'),
      /* Und es steht die **Gruppe** da, kein einzelnes Feld daraus. */
      einzelne: alleAngaben.filter((x) => String(x).indexOf(name + '.') === 0),
      geschrieben: window.__WROTE__.includes('registry/interfaces'),
    };
  });
  pruefe('clicking a group puts it into the view',
    geklickt.sichtbar && geklickt.geschrieben, geklickt);
  pruefe('and it writes the group name, not every field of it',
    geklickt.einzelne.length === 0
    && Array.isArray(geklickt.fields) && geklickt.fields.includes(geklickt.name),
    geklickt);
  /* Genau dasselbe Feld zurück — nicht irgendeines. Es sind noch andere
     aus, und die sind es zu Recht: der Bogen zeichnet sie schon. */
  const zurueck2 = await p.evaluate(async (ref) => {
    const knopf = document.querySelector(`.tmplfields .tgl[data-comp="${ref}"]`);
    const warAn = knopf.classList.contains('on');
    knopf.click();
    await new Promise((r) => setTimeout(r, 300));
    const nun = document.querySelector(`.tmplfields .tgl[data-comp="${ref}"]`);
    const eigen = (window.__T__.REG.interfaces.PlayerCharacter.views || {}).quick || [];
    const feldEl = eigen.find((x) => x.el === 'fields')
      || (eigen.find((x) => x.el === 'tabs')?.tabs || [])
        .flatMap((t) => t.layout).find((x) => x.el === 'fields');
    return { warAn, wiederAn: nun.classList.contains('on'),
      fields: Array.isArray(feldEl?.fields) ? feldEl.fields : null,
      except: feldEl?.except ?? [] };
  }, geklickt.name);
  pruefe('clicking it again takes that very one out',
    zurueck2.warAn && !zurueck2.wiederAn
    && !(zurueck2.fields || []).includes(geklickt.name), zurueck2);

  /* Eine geerbte Anordnung sagt, woher sie kommt — sie zu bearbeiten ändert
     sie für jede Unterart mit, und das soll niemand aus Versehen tun.
     Geprüft an einer Probeart: im Register erbt keine Zeile mehr eine
     Anordnung, seit die Kreatur selbst eine Art ist und die Spielerfigur
     weiter oben eine eigene bekommen hat. Eine Prüfung braucht den Fall
     und nicht die Zeile. */
  const geerbt2 = await p.evaluate(async () => {
    const T = window.__T__;
    T.REG.interfaces.ErbArt = { name: 'ErbArt', label: 'Erb art', extends: ['Creature'] };
    T.UI.typePick = 'ErbArt';
    /* `full` ist die Ansicht, die `Creature` selbst anordnet — an ihr ist
       „geerbt" zu sehen. Bei `quick` sagt die Vorlage „die Grundanordnung
       der Ansicht", und das ist eine andere Auskunft. */
    T.UI.typeView = 'full';
    T.render();
    await new Promise((r) => setTimeout(r, 300));
    const raus = {
      sagt: document.querySelector('.tmpl .maptools .hint')?.textContent ?? '',
      zu: document.querySelectorAll('.tmplfields .tgl[disabled]').length > 0,
      knopf: [...document.querySelectorAll('.tmpl .maptools .btn')].map((b) => b.textContent),
      woher: T.layoutSource(T.REG.views.full, 'ErbArt', 'full').iface,
    };
    delete T.REG.interfaces.ErbArt;
    T.UI.typePick = 'PlayerCharacter';
    T.render();
    return raus;
  });
  pruefe('an inherited arrangement says so and is not edited by accident',
    /Inherited from/.test(geerbt2.sagt) && geerbt2.zu
    && geerbt2.woher === 'Creature'
    && geerbt2.knopf.some((x) => /Give it its own/.test(x)), geerbt2);

  /* Welche Ansicht die Vorlage zeigt, wird **an der Art** gewählt und nicht
     oben rechts für die ganze Seite: die Anordnung gehört der Art, also
     gehört die Wahl dorthin, wo die Art steht. `full` ist die Grundlage, in
     der alles steht; die engeren lassen weg. */
  const engere = await p.evaluate(async () => {
    const T = window.__T__;
    T.UI.typePick = 'PlayerCharacter';
    T.render();
    await new Promise((r) => setTimeout(r, 300));
    const chips = [...document.querySelectorAll('.chip.pick[data-vk]')].map((c) => c.dataset.vk);
    document.querySelector('.chip.pick[data-vk="quick"]').click();
    await new Promise((r) => setTimeout(r, 350));
    const nun = [...document.querySelectorAll('.tmplel > .ck > code')].map((x) => x.textContent);
    document.querySelector('.chip.pick[data-vk="full"]').click();
    await new Promise((r) => setTimeout(r, 350));
    return { chips, nun };
  });
  /* **Der Ort wählt die Ansicht.** Oben rechts stand ein Dropdown, und wer
     es jedes Mal bedienen muss, bedient es irgendwann falsch. Ein Verweis
     ist ein Verweis, eine Listenzeile ist eine Zeile, und die Artikelseite
     zeigt alles. */
  const ortWaehlt = await p.evaluate(() => {
    const T = window.__T__;
    const pc = [...T.ENT.values()].find((e) => (e.interfaces || [])[0] === 'PlayerCharacter');
    return {
      waehler: !document.getElementById('facet'),
      ansichten: Object.keys(T.REG.views),
      /* Eine Übersicht ist ein Satz und keine Feldtabelle. */
      ueber: [...T.layoutOf(T.REG.views.overview, 'PlayerCharacter', 'overview')].map((x) => x.el),
      /* Und sie zeigt keine: die Auswahl ist leer. */
      ueberFelder: (() => {
        const f = [...T.layoutOf(T.REG.views.overview, 'PlayerCharacter', 'overview')]
          .find((x) => x.el === 'fields');
        return Array.isArray(f?.fields) ? f.fields.length : -1;
      })(),
      voll: [...T.layoutOf(T.REG.views.full, 'PlayerCharacter', 'full')].map((x) => x.el),
      /* Und die volle Anordnung einer Kreatur kommt von `Creature`
         selbst — die Art trägt sie, und ihre Unterarten erben sie. */
      woher: T.layoutSource(T.REG.views.full, 'Creature', 'full').iface,
      pc: pc ? pc.id : null,
    };
  });
  pruefe('the picker at the top right is gone — the place decides',
    ortWaehlt.waehler === true
    && ortWaehlt.ansichten.join() === 'overview,quick,full', ortWaehlt.ansichten);
  /* Eine Übersicht ist ein Satz. Die Feldtabelle steht darin mit **leerer**
     Auswahl: so lässt sich je Art eine Gruppe dazunehmen, ohne dass aus
     einem Verweis eine Tabelle wird — und solange niemand etwas ankreuzt,
     steht dort nur der Satz. */
  pruefe('an overview is a sentence, the article page is everything',
    ortWaehlt.ueber.join() === 'description,fields' && ortWaehlt.ueberFelder === 0
    && ortWaehlt.voll.includes('sheet') && ortWaehlt.voll.length > 1,
    { ueber: ortWaehlt.ueber, voll: ortWaehlt.voll });
  pruefe('and a kind inherits its arrangement instead of repeating it',
    ortWaehlt.woher === 'Creature', ortWaehlt.woher);

  pruefe('the three views are picked at the kind, not at a switch for the whole page',
    engere.chips.join() === 'overview,quick,full', engere.chips);
  pruefe('and a narrower one leaves things out',
    engere.nun.length > 0 && !engere.nun.includes('sheet'), engere.nun);
  pruefe('the template raised no exception', errs.length === 0, errs);

  /* ---- Mehrfachvererbung ----
     `extends` ist ein Array, und war es immer. Der Code las überall `[0]`:
     die **Felder** erbten über alle Obertypen (`compsFor` läuft `forEach`),
     Kanten, Bereich und Anordnung nur über den ersten. Zwei Antworten auf
     dieselbe Frage, und die eine war still falsch — man hätte es erst
     gemerkt, wenn eine Art von zweien erbt. Die Prüfung legt genau so eine
     an. */
  const zweiEltern = await p.evaluate(async () => {
    const T = window.__T__;
    /* Ein Obertyp im Bereich `rules` mit eigenem Feld und eigener Prosa —
       damit sich alle drei Vererbungswege prüfen lassen. */
    T.REG.interfaces.ProbeOben = {
      name: 'ProbeOben', label: 'Probe oben', area: 'rules', abstract: true,
      extends: ['Identity'],
      schema: { type: 'object', properties: {
        probefeld: { type: 'string', title: 'Probe' },
        probeprosa: { type: 'string', format: 'long', many: true, title: 'Probe prose' } } },
    };
    /* Erbt von **zwei** Ästen: Item (Bereich world) und ProbeOben (game). */
    T.REG.interfaces.ProbeZwei = {
      name: 'ProbeZwei', label: 'Probe zwei', extends: ['Item', 'ProbeOben'],
    };
    const antwort = {
      /* Felder: liefen schon über alle. */
      felder: T.compsFor('ProbeZwei'),
      /* Bereich: der erste Ast gewinnt — Item steht vorn, also `world`. */
      bereich: T.areaOf('ProbeZwei'),
      /* Prosafelder: die des zweiten Astes müssen dabei sein. */
      prosa: T.proseFields('ProbeZwei').map((f) => f.type + '.' + f.key),
      /* Kanten: eine Kante, die an `Item` hängt, und eine an `Identity`. */
      kanten: T.relsFrom('ProbeZwei').map((r) => r.type),
      /* Und woher ein Feld kommt, muss über beide Äste gefunden werden. */
      herkunft: T.compOrigin('ProbeZwei', 'ProbeOben'),
    };
    delete T.REG.interfaces.ProbeZwei;
    delete T.REG.interfaces.ProbeOben;
    return antwort;
  });
  pruefe('a kind may inherit from two branches, and gets both their fields',
    zweiEltern.felder.includes('ProbeOben') && zweiEltern.felder.includes('Item'),
    zweiEltern.felder);
  pruefe('passage fields come from every branch, not just the first',
    zweiEltern.prosa.includes('ProbeOben.probeprosa') && zweiEltern.prosa.includes('Lore.lore'),
    zweiEltern.prosa);
  /* Der Bereich kann nur einer sein: der erste genannte Ast gewinnt. Eine
     Reihenfolge, nach der man eine Aufzählung liest. */
  pruefe('the area comes from the branch named first',
    zweiEltern.bereich === 'world', zweiEltern.bereich);
  pruefe('and where a component comes from is found across branches',
    zweiEltern.herkunft && zweiEltern.herkunft.iface === 'ProbeOben', zweiEltern.herkunft);
  pruefe('multiple inheritance raised no exception', errs.length === 0, errs);
  pruefe('the type overview raised no exception', errs.length === 0, errs);

  /* ---- Prosaanker und Kampagnenwerte (B3) ----
     Beides hängt daran, dass ein Bezeichner hält. Ein Anker, der sich beim
     Import ändert, nimmt jede Wissenszuteilung mit ins Leere — und das
     fällt niemandem auf: die Stelle ist da, der Text ist da, und die
     Information hat nur plötzlich nichts mehr zu verbergen.

     Seit Blöcke Felder sind, ist der Anker die **Eintrags-Id** eines Feldes
     mit `many`. Eine erzeugte Id (`e0`, `e1` …) hält nur, solange die
     Reihenfolge hält — genau daran hing der Verlust. */
  const anker = await p.evaluate(() => {
    const T = window.__T__;
    let stellen = 0, erzeugt = 0;
    const doppelt = {};
    T.ENT.forEach((e) => {
      const hier = {};
      T.allProse(e).forEach((x) => {
        stellen++;
        if (/^e\d+$/.test(x.id)) erzeugt++;
        if (hier[x.ref]) doppelt[e.id] = x.ref;
        hier[x.ref] = 1;
      });
    });
    return { stellen, erzeugt, doppelt: Object.keys(doppelt) };
  });
  pruefe('every passage carries an anchor, and none of them is a generated id',
    anker.stellen > 0 && anker.erzeugt === 0, anker);
  pruefe('anchors are unique inside their own article',
    anker.doppelt.length === 0, anker.doppelt);

  /* Der Anker kommt aus dem Text, also ergibt derselbe Text denselben
     Anker — das ist die ganze Eigenschaft, um die es geht. */
  const stabil = await p.evaluate(() => {
    const T = window.__T__;
    let treffer = null;
    T.ENT.forEach((e) => {
      if (treffer) return;
      const st = T.allProse(e);
      if (st.length) treffer = st[0];
    });
    return { alt: treffer.id, neu: T.entryAnchor(treffer.key, treffer.value, {}) };
  });
  pruefe('the same text yields the same anchor, whatever its id is',
    stabil.alt === stabil.neu, stabil);

  /* Und die Wissenszuteilungen zeigen auf Anker, nicht auf erzeugte Ids. */
  const zuteilung = await p.evaluate(() => {
    const T = window.__T__;
    const echte = {};
    T.ENT.forEach((e) => T.allProse(e).forEach((x) => { echte[x.ref] = 1; }));
    const schlecht = [];
    T.ENT.forEach((i) => {
      const info = (i.components || {}).Information;
      if (!info || !Array.isArray(info.fields)) return;
      info.fields.forEach((r) => {
        if (r.indexOf('#') < 0) return;         /* ein ganzes Feld, kein Eintrag */
        if (/#e\d+$/.test(r) || !echte[r]) schlecht.push(i.id + ':' + r);
      });
    });
    return schlecht;
  });
  pruefe('a knowledge grant on a passage names its anchor, not a generated id',
    zuteilung.length === 0, zuteilung);

  /* Kampagnenwerte: gerechnet, und sie schlagen eine gleichnamige Zeile im
     Register. Eine eingetippte Gruppenstufe ist nach der ersten Stufe
     falsch, und niemand merkt es, weil sie plausibel aussieht. */
  const werte = await p.evaluate(() => {
    const T = window.__T__;
    const vor = T.campaignVars();
    T.REG.vars.PARTYLEVEL = '99';
    T.REG.vars.EINGETIPPT = 'aus dem Register';
    const text = T.fillVars('{PARTYLEVEL} · {PARTYSIZE} · {PARTY} · {EINGETIPPT} · {NICHTDA}', null, null)
      .replace(/[\u0001\u0002]/g, '');
    delete T.REG.vars.PARTYLEVEL;
    delete T.REG.vars.EINGETIPPT;
    return { vor, text };
  });
  pruefe('the party level is computed from its members, not typed in',
    Number(werte.vor.PARTYLEVEL) > 0 && Number(werte.vor.PARTYSIZE) > 0, werte.vor);
  pruefe('a computed value beats a typed one with the same name',
    werte.text.indexOf('99') < 0 && werte.text.indexOf(werte.vor.PARTYLEVEL) === 0, werte.text);
  pruefe('a typed variable still resolves, and an unknown one stays as it is',
    /aus dem Register/.test(werte.text) && /\{NICHTDA\}/.test(werte.text), werte.text);
  pruefe('where the party is comes from its token on a map, not a second field',
    typeof werte.vor.PARTYWHERE === 'string', werte.vor.PARTYWHERE);

  /* ---- Charakterbogen und Inventar (REQ-051, 063, 064, 065) ----
     Der Bogen rechnet aus zwei Karten: die ruhigen Zahlen vom Statblock,
     der Stand aus Vitals. Rechnet er falsch, steht am Tisch eine plausible
     Zahl da und niemand merkt es — deshalb gegen bekannte Werte geprüft. */
  const held = await p.evaluate(() => {
    const T = window.__T__;
    /* Die Zahlen stehen am Statblock, nicht an der Figur: gesucht wird
       eine, die einen hat — `statsOf` geht die Kante `belongsTo` zurück. */
    const m = [...T.ENT.values()].find((e) =>
      (e.components || {}).Proficiencies
      && Object.keys(T.statsOf(e).card).length
      && (e.relations || []).some((r) => r.type === 'carries'));
    return m ? m.name : null;
  });
  if (held) {
    await oeffne(held);
    await p.waitForTimeout(400);
    const bogen = await p.evaluate(() => {
      const ab = {};
      document.querySelectorAll('.ability').forEach((a) => {
        ab[a.querySelector('.k').textContent] =
          a.querySelector('.score').textContent + a.querySelector('.mod').textContent;
      });
      const sk = {};
      document.querySelectorAll('.skillrow').forEach((r) => {
        sk[r.querySelector('.sname').textContent] = r.querySelector('.smod').textContent;
      });
      return {
        ab, sk,
        hp: document.querySelector('.vital.hp .vin')?.value ?? null,
        pips: document.querySelectorAll('.pip').length,
        angriffe: [...document.querySelectorAll('table.atk tr')].length - 1,
        probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
      };
    });
    /* DEX 17 gibt +3; Expertise verdoppelt den Übungsbonus, also Stealth
       +3+2*3 = +9 bei Übungsbonus 3. Eine Zahl, die man nachrechnen kann. */
    pruefe('the sheet computes ability modifiers', bogen.ab.DEX === '17+3', bogen.ab);
    pruefe('expertise doubles the proficiency bonus',
      bogen.sk.Stealth === '+9' && bogen.sk.Arcana === '+2', bogen.sk);
    pruefe('the current hit points come from Vitals, not from the maximum',
      bogen.hp === '31', bogen.hp);
    pruefe('hit dice, death saves and inspiration are pips', bogen.pips >= 7, bogen.pips);
    pruefe('attacks come from what is carried', bogen.angriffe >= 2, bogen.angriffe);
    pruefe('the character validates clean', bogen.probleme.length === 0, bogen.probleme);

    /* Ein Zustand ist ein Klick, kein Formular. */
    await p.evaluate(() =>
      [...document.querySelectorAll('.condrow .chip')].find((c) => c.textContent === 'prone').click());
    await p.waitForTimeout(400);
    const zust = await p.evaluate(() =>
      [...document.querySelectorAll('.condrow .chip')].filter((c) => c.classList.contains('on'))
        .map((c) => c.textContent));
    pruefe('a condition is one click', zust.includes('prone'), zust);
    await p.evaluate(() =>
      [...document.querySelectorAll('.condrow .chip')].find((c) => c.textContent === 'prone').click());
    await p.waitForTimeout(300);

    /* Das Inventar: drei Darstellungen, dieselben Daten. Seit der Bogen
       Reiter hat, liegt es hinter „Gear" — der Vitalstreifen bleibt oben,
       alles andere schaltet um. */
    await p.waitForTimeout(400);
    pruefe('a character sheet has tabs, and the vitals stay above them',
      await p.evaluate(() => ({
        reiter: [...document.querySelectorAll('.tabrow .btn')].map((b) => b.textContent),
        /* Der Bogen steht **vor** der Reiterleiste im Baum: was man ohne
           Umschalten braucht, darf nicht in einem Reiter liegen. */
        bogenOben: !!(document.querySelector('.sheet')
          && document.querySelector('.tabbox')
          && (document.querySelector('.sheet').compareDocumentPosition(
                document.querySelector('.tabbox')) & Node.DOCUMENT_POSITION_FOLLOWING)),
      })).then((x) => {
        return x.reiter.includes('Overview') && x.reiter.includes('Gear') && x.bogenOben;
      }), 'siehe Reiterleiste');
    await reiter('Gear');
    const stufen = await p.evaluate(() => ({
      reiter: [...document.querySelectorAll('.invbox .ktabs button')].map((b) => b.textContent),
      stufen: [...document.querySelectorAll('.tier .tlabel b')].map((b) => b.textContent),
      stuecke: document.querySelectorAll('.tier .chip.item').length,
    }));
    pruefe('the inventory shows the five degrees of reach',
      stufen.stufen.length === 5 && stufen.stufen[0] === 'In hand' && stufen.stuecke > 3, stufen);

    await p.evaluate(() =>
      [...document.querySelectorAll('.invbox .ktabs button')].find((b) => /Grid/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    const raster = await p.evaluate(() => ({
      zellen: document.querySelectorAll('.gcell').length,
      stuecke: [...document.querySelectorAll('.gitem')].map((i) => ({
        n: i.querySelector('.glab').textContent, c: i.style.gridColumn, r: i.style.gridRow })),
    }));
    pruefe('the tile grid is as large as the settings say',
      raster.zellen === 60, raster.zellen);
    /* Die Form kommt aus `Footprint`: eine Rüstung ist 3 breit und 2 hoch,
       ein Kurzschwert 1 breit und 3 hoch. Ein Raster, das alles gleich gross
       zeichnet, ist eine Liste mit Kästchen. */
    const ruestung = raster.stuecke.find((x) => /Leder/.test(x.n));
    const schwert = raster.stuecke.find((x) => /^Kurzschwert /.test(x.n) || /^Kurzschwert$/.test(x.n));
    pruefe('an item takes the shape its footprint gives it',
      !!ruestung && /span 3/.test(ruestung.c) && /span 2/.test(ruestung.r)
      && !!schwert && /span 1/.test(schwert.c) && /span 3/.test(schwert.r),
      { ruestung, schwert });

    /* Ein Stück aufnehmen und woanders hinlegen — der ganze Weg, den man am
       Tisch geht. Ein belegtes Feld muss dabei nein sagen. */
    const vorher = raster.stuecke.find((x) => /Diebeswerkzeug/.test(x.n));
    await p.evaluate(() =>
      [...document.querySelectorAll('.gitem')].find((i) => /Diebeswerkzeug/.test(i.textContent)).click());
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      const g = document.querySelector('.invgrid');
      const zellen = [...g.querySelectorAll('.gcell')];
      /* Die letzte Zeile ist frei — dort ist Platz für zwei Felder. */
      zellen[zellen.length - 10].click();
    });
    await p.waitForTimeout(450);
    const nachher = await p.evaluate(() =>
      [...document.querySelectorAll('.gitem')].map((i) => ({
        n: i.querySelector('.glab').textContent, c: i.style.gridColumn, r: i.style.gridRow })));
    const jetzt = nachher.find((x) => /Diebeswerkzeug/.test(x.n));
    pruefe('an item can be picked up and put somewhere else',
      !!jetzt && jetzt.r !== vorher.r, { vorher, jetzt });

    /* ---- Die Zahlen wohnen am Statblock ----
     Auch die eines Spielercharakters: er hat mehr darüber hinaus, aber AC,
     HP-Maximum und die sechs Werte sind dieselbe Sache wie bei jedem
     Monster. Vorher trug er sie selbst, und der Bogen las „erst die eigene
     Karte, dann die geliehene" — zwei Formen für dasselbe. */
    const woher = await p.evaluate(() => {
      const T = window.__T__;
      const figuren = [...T.ENT.values()]
        .filter((e) => ['PlayerCharacter', 'Creature'].includes((e.interfaces || [])[0]));
      return {
        eigene: figuren.filter((e) => (e.components || {}).Abilities
          || (e.components || {}).Statblock).map((e) => e.name),
        /* Wer einen Statblock hat, liest ihn. Wer keinen hat, hat keine
           Zahlen — und das ist richtig: der Händler am Lampenplatz kämpft
           nicht, und eine frisch angelegte Figur hat noch nichts. Ihnen
           einen Statblock zu geben, damit die Prüfung grün wird, hiesse
           Daten für die Prüfung zu erfinden. */
        mitKante: figuren.filter((e) => [...T.ENT.values()].some((o) =>
          (o.relations || []).some((r) => r.type === 'belongsTo' && r.to === e.id)))
          .map((e) => ({ n: e.name, liest: Object.keys(T.statsOf(e).card).length > 0 })),
        /* Und der Statblock liest seine eigene Karte. */
        amStatblock: [...T.ENT.values()]
          .filter((e) => (e.interfaces || [])[0] === 'Statblock')
          .every((e) => T.statsOf(e).from === e),
      };
    });
    pruefe('no creature carries its own numbers any more', woher.eigene.length === 0, woher);
    pruefe('and whoever has a statblock reads it — players included',
      woher.mitKante.length >= 3 && woher.mitKante.every((x) => x.liest) && woher.amStatblock,
      woher);

    pruefe('the sheet and the inventory raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a character with skills and gear exists in the data', false, 'keiner gefunden');
  }

  /* ---- Handwerk (REQ-184) ----
     Die Probe aufs Wissensmodell: ein Rezept, das jemand kennt, ist eine
     Information mit `knownBy` — kein Feld „bekannt von" am Rezept. Wenn das
     trägt, steht Crafting auf demselben Rückgrat wie alles andere. */
  const werkbank = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const rezept = alle.find((e) => (e.interfaces || [])[0] === 'Recipe'
      && (e.relations || []).some((r) => r.type === 'knowledge'));
    const kenner = alle.find((e) => (e.relations || []).some((r) => r.type === 'carries'));
    return {
      rezept: rezept ? (rezept.name || (rezept.components.Imported || {}).text) : null,
      kenner: kenner ? (kenner.name || (kenner.components.Imported || {}).text) : null,
    };
  });
  if (werkbank.rezept && werkbank.kenner) {
    await oeffne(werkbank.rezept);
    await p.waitForTimeout(400);
    const rez = await p.evaluate(() => ({
      kopf: [...document.querySelectorAll('.crhead .pill')].map((x) => x.textContent),
      zeilen: [...document.querySelectorAll('table.craftm tr')]
        .map((r) => [...r.children].map((c) => c.textContent)),
      kenner: [...document.querySelectorAll('.craft .chips .chip')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('a recipe shows its trade, check and time', rez.kopf.length >= 3, rez.kopf);
    /* Die Matrix hat je Träger eine Spalte — „hat jemand von uns genug?" ist
       die Frage am Tisch, nicht „hat diese eine Figur genug?". */
    pruefe('the material matrix has a column per carrier',
      rez.zeilen.length > 2 && rez.zeilen[0].length >= 3, rez.zeilen[0]);
    pruefe('who knows the recipe comes from the knowledge edges, not from a field',
      rez.kenner.length > 0, rez.kenner);
    pruefe('the recipe validates clean', rez.probleme.length === 0, rez.probleme);

    /* Die Werkbank an der Figur: bekannt, teilweise, unbekannt — und was
       fehlt, steht als Zahl da, nicht als „nein". */
    await oeffne(werkbank.kenner);
    await p.waitForTimeout(400);
    const bank = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('table.craftm tr.crrow')]
        .map((r) => [...r.children].map((c) => c.textContent)),
      knoepfe: [...document.querySelectorAll('table.craftm tr.crrow .btn')].length,
    }));
    pruefe('the workbench lists the recipes with what is missing',
      bank.zeilen.length >= 2
      && bank.zeilen.some((z) => /\d+\/\d+/.test(z[2]) || /all there/.test(z[2])), bank.zeilen);
    pruefe('a recipe that is all there can be started', bank.knoepfe > 0, bank.knoepfe);

    /* Ein Gang, der wirklich läuft (REQ-184). Das Material geht am Anfang
       hinein — deshalb kann er scheitern und etwas kosten. Gewürfelt wird
       am letzten Tag, und der Wurf wird nachgelesen, nicht geglaubt.

       Der Würfel ist echt, also wird der Schwierigkeitsgrad gesetzt: einmal
       auf 1, damit er gelingt, und einmal auf 99, damit er scheitert. Eine
       Prüfung, die „irgendeines von beidem" hinnimmt, prüft keinen der
       beiden Zweige. */
    const vorrat = () => p.evaluate(() => {
      const T = window.__T__;
      const traeger = [...T.ENT.values()].find((e) =>
        (e.relations || []).some((r) => r.type === 'carries'));
      const inv = T.ENT.get(traeger.relations.find((r) => r.type === 'carries').to);
      const m = {};
      (inv.relations || []).filter((r) => r.type === 'holds').forEach((r) => {
        const it = T.ENT.get(r.to);
        if (it) m[it.name || (it.components.Imported || {}).text] = (r.props || {}).qty || 1;
      });
      return m;
    });
    const zustand = () => p.evaluate(() => ({
      jobs: [...document.querySelectorAll('.job')].map((j) => ({
        text: j.querySelector('.co')?.textContent ?? '',
        knopf: j.querySelector('.rowbtns .btn')?.textContent ?? '',
        zu: !!j.querySelector('.rowbtns .btn')?.disabled,
        balken: j.querySelector('.jbar i')?.style.width ?? '',
        /* Was im Kessel liegt: je Zutat eine Zeile mit „x/y in". */
        material: [...j.querySelectorAll('ul.jmat li')].map((li) => ({
          offen: li.classList.contains('short'),
          text: li.querySelector('.co')?.textContent ?? '',
        })),
        nachlegen: [...j.querySelectorAll('.rowbtns .btn')]
          .some((b) => /Put everything in/.test(b.textContent)),
      })),
      log: [...document.querySelectorAll('.bench p.hint')].map((x) => x.textContent),
    }));
    const starten = async (dc) => {
      await p.evaluate((d) => {
        const T = window.__T__;
        const traeger = [...T.ENT.values()].find((e) =>
          (e.relations || []).some((r) => r.type === 'carries'));
        /* Das Rezept, das in der ersten Zeile bereitsteht — dasselbe, das
           der Knopf anfangen würde. */
        const zeile = document.querySelector('table.craftm tr.crrow.ready .ref');
        const rez = [...T.ENT.values()].find((e) =>
          (e.interfaces || [])[0] === 'Recipe'
          && (e.name || (e.components.Imported || {}).text) === zeile.textContent);
        rez.components.Recipe.dc = d;
        rez.components.Recipe.days = 2;
        traeger.relations = (traeger.relations || []).filter((r) => r.type !== 'crafting');
        window.__T__.UI.craftLog = [];
      }, dc);
      await p.evaluate(() => window.__T__.render());
      await p.waitForTimeout(300);
      await p.evaluate(() =>
        [...document.querySelectorAll('table.craftm tr.crrow.ready .btn')][0].click());
      await p.waitForTimeout(250);
      await p.evaluate(() =>
        [...document.querySelectorAll('.dlgbox .rowbtns button')]
          .find((b) => /^Start$/.test(b.textContent)).click());
      await p.waitForTimeout(450);
    };
    const arbeiten = async () => {
      await p.evaluate(() => document.querySelector('.job .rowbtns .btn').click());
      await p.waitForTimeout(400);
    };
    /* Alles nachlegen, was da ist — derselbe Knopf, den man am Tisch
       drückt, und nicht ein Griff an die Daten daneben. */
    const nachlegen = async () => {
      await p.evaluate(() => [...document.querySelectorAll('.job .rowbtns .btn')]
        .find((b) => /Put everything in/.test(b.textContent)).click());
      await p.waitForTimeout(450);
    };

    const vorStart = await vorrat();
    await starten(1);
    const nachStart = await vorrat();
    /* **Nichts geht am Anfang hinein.** Am Tisch fängt man an, weil man
       etwas vorhat, und sammelt dabei. */
    pruefe('starting a craft takes nothing out of the pack yet',
      Object.keys(vorStart).every((k) => (nachStart[k] ?? 0) === vorStart[k]),
      { vorStart, nachStart });
    const tag0 = await zustand();
    pruefe('a running craft shows how far along it is',
      tag0.jobs.length === 1 && /0\/2 days/.test(tag0.jobs[0].text), tag0.jobs);
    pruefe('and it lists what is still to go in',
      tag0.jobs[0].material.length > 0 && tag0.jobs[0].material.every((m) => m.offen)
      && /^0\//.test(tag0.jobs[0].material[0].text), tag0.jobs[0].material);
    pruefe('nothing is yielded before the work is done',
      !Object.keys(nachStart).some((k) => (vorStart[k] ?? 0) < nachStart[k]),
      { vorStart, nachStart });

    await arbeiten();
    const tag1 = await zustand();
    pruefe('a day of work moves it on without rolling anything',
      tag1.jobs.length === 1 && /1\/2 days/.test(tag1.jobs[0].text)
      && /Last day/.test(tag1.jobs[0].knopf) && tag1.log.length === 0, tag1);
    /* Arbeiten geht immer, fertig werden nicht: ein Wurf auf halbes
       Material wäre ein Wurf auf nichts, und der Tag wäre weg. */
    pruefe('the last day stays shut while something is still missing',
      tag1.jobs[0].zu === true && tag1.jobs[0].nachlegen === true, tag1.jobs[0]);

    await nachlegen();
    const gefuellt = await zustand();
    const nachFuellen = await vorrat();
    pruefe('putting the materials in takes them out of the pack',
      Object.keys(vorStart).some((k) => (nachFuellen[k] ?? 0) < vorStart[k]),
      { vorStart, nachFuellen });
    pruefe('and now the last day is open',
      gefuellt.jobs[0].material.every((m) => !m.offen) && gefuellt.jobs[0].zu === false,
      gefuellt.jobs[0]);

    await arbeiten();
    const fertig = await zustand();
    const nachFertig = await vorrat();
    pruefe('the last day rolls the check and says what it rolled against',
      fertig.jobs.length === 0 && fertig.log.length === 1
      && /vs DC 1 — made it/.test(fertig.log[0]), fertig.log);
    pruefe('a success puts the result in the pack',
      Object.keys(nachFertig).some((k) => (nachFuellen[k] ?? 0) < nachFertig[k]),
      { nachFuellen, nachFertig });

    /* Und der andere Zweig: gescheitert, und `onFailure` entscheidet, was
       zurückkommt. Ohne diesen Zweig wäre die Zeile im Register Zierrat. */
    const vorFehl = await vorrat();
    await starten(99);
    await nachlegen();
    await arbeiten();
    await arbeiten();
    const gescheitert = await zustand();
    const nachFehl = await vorrat();
    pruefe('a failure says so and does not yield the result',
      gescheitert.jobs.length === 0 && gescheitert.log.length === 1
      && /vs DC 99 — failed/.test(gescheitert.log[0]), gescheitert.log);
    pruefe('a failure costs materials — that is what starting them meant',
      Object.keys(vorFehl).some((k) => (nachFehl[k] ?? 0) < vorFehl[k]),
      { vorFehl, nachFehl });
    /* Das Werkzeug gehört zu „was fehlt". Es getrennt zu behandeln hiesse,
       dass die Matrix „ja" sagt und das Anfangen „nein". */
    const werkzeugFehlt = await p.evaluate(() => {
      const T = window.__T__;
      const traeger = [...T.ENT.values()].find((e) =>
        (e.relations || []).some((r) => r.type === 'carries'));
      const inv = T.ENT.get(traeger.relations.find((r) => r.type === 'carries').to);
      const weg = inv.relations.filter((r) => {
        const it = T.ENT.get(r.to);
        return it && /werkzeug|form/i.test(it.name || '');
      });
      inv.relations = inv.relations.filter((r) => weg.indexOf(r) < 0);
      window.__T__.render();
      return weg.length;
    });
    await p.waitForTimeout(400);
    const ohneWerkzeug = await p.evaluate(() =>
      [...document.querySelectorAll('table.craftm tr.crrow')]
        .map((r) => r.className + '|' + r.children[2].textContent));
    pruefe('without the tool nothing is ready, and the reason says which tool',
      werkzeugFehlt > 0 && ohneWerkzeug.every((z) => !/ready/.test(z))
      && ohneWerkzeug.some((z) => /no \w+werkzeug|no Kerzenzieherform/i.test(z)),
      ohneWerkzeug);

    /* Der Übungsbonus kommt aus den Werkzeugübungen in
       `Proficiencies.proficient` — den Einträgen, die aus der Liste `Tool`
       kommen —, nicht aus einer Annahme.
       Rook ist in Alchemie geübt, die Gruppe als solche nicht. */
    const boni = await p.evaluate(() => {
      const T = window.__T__;
      const rez = [...T.ENT.values()].find((e) =>
        ((e.components || {}).Recipe || {}).tool === 'Alchemistenwerkzeug');
      const info = rez.components.Recipe;
      const rook = [...T.ENT.values()].find((e) =>
        (((e.components || {}).Proficiencies || {}).proficient || [])
          .indexOf('Alchemistenwerkzeug') >= 0);
      const andere = [...T.ENT.values()].find((e) =>
        (e.interfaces || [])[0] === 'Party');
      return { rook: T.craftMod(rook, info), andere: T.craftMod(andere, info) };
    });
    pruefe('tool proficiency comes from the data, and only for who has it',
      boni.rook.proficient === true && boni.andere.proficient === false
      && boni.rook.mod > boni.andere.mod, boni);

    pruefe('crafting raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a recipe with knowledge and a carrier exist in the data', false, werkbank);
  }

  /* ---- Boards (REQ-111, 157 bis 166) ----
     Der Prüfstein ist die Darstellungsauflösung: jede Platzierung wird in
     der Ansicht gezeichnet, die Platzierung → Board-Regel → Rückfall ergibt,
     und zwar mit *denselben* Elementen wie die Artikelseite. Zeichnete das
     Board eigene Kacheln, wäre jedes neue Element zweimal zu bauen. */
  const boardName = await p.evaluate(() => {
    const b = [...window.__T__.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Board');
    return b ? (b.name || (b.components.Imported || {}).text) : null;
  });
  if (boardName) {
    await oeffne(boardName);
    await p.waitForTimeout(700);
    const brd = await p.evaluate(() => ({
      karten: [...document.querySelectorAll('.bcard')].map((c) => ({
        n: c.querySelector('.bhead .ref')?.textContent ?? null,
        v: c.querySelector('.bview')?.textContent ?? null,
        leer: !(c.querySelector('.pbody')?.textContent || '').trim(),
        l: c.style.left, t: c.style.top })),
      formen: document.querySelectorAll('.bshape').length,
      anker: [...(document.querySelectorAll('.maptools select')[1]?.options ?? [])]
        .map((o) => o.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the board draws every placement', brd.karten.length >= 4, brd.karten.length);
    pruefe('no placement comes out empty',
      brd.karten.every((k) => !k.leer), brd.karten.filter((k) => k.leer));
    /* Verschiedene Stufen nebeneinander — das ist die Auflösung. Neu ist,
       **was** sie entscheidet: seit es drei Stufen statt einundzwanzig
       gibt, sagt die Artikelart die Form (eine Figur zeigt ihr Blatt) und
       die Stufe nur noch, wie viel davon. Die Prüfung fragt deshalb
       beides. */
    const ansichten = [...new Set(brd.karten.map((k) => k.v))];
    pruefe('placements resolve to different levels', ansichten.length >= 2, ansichten);
    const formen = await p.evaluate(() => [...document.querySelectorAll('.bcard')].map((k) => ({
      v: k.querySelector('.bview')?.textContent ?? '',
      bogen: !!k.querySelector('.ability'),
    })));
    pruefe('the article kind decides the shape, the level only how much',
      formen.some((k) => /Full/i.test(k.v) && k.bogen)
        && formen.every((k) => !(/Quick/i.test(k.v) && k.bogen)), formen);
    pruefe('shapes and anchors belong to the board', brd.formen >= 3 && brd.anker.length >= 3,
      { formen: brd.formen, anker: brd.anker });
    pruefe('the board validates clean', brd.probleme.length === 0, brd.probleme);

    /* Die Ansicht einer einzelnen Platzierung überstimmt die Board-Regel. */
    const vorher = brd.karten[1];
    await p.evaluate(() => {
      const s2 = [...document.querySelectorAll('.bcard')][1].querySelector('.bsel');
      s2.value = 'full';
      s2.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(500);
    const nachher = await p.evaluate(() => ({
      v: [...document.querySelectorAll('.bcard')][1]?.querySelector('.bview')?.textContent ?? null,
    }));
    pruefe('a placement may overrule the board rule',
      nachher.v === 'Full' && nachher.v !== vorher.v, { vorher: vorher.v, nachher: nachher.v });

    /* Eine Karte, die auf einem Board liegt, bringt ihre Werkzeugleiste
       nicht mit: ein Zoomknopf dort änderte den Zoom der grossen Karte. */
    const leisten = await p.evaluate(() =>
      [...document.querySelectorAll('.bcard .maptools')].filter((m) => m.style.display !== 'none').length);
    pruefe('a placement brings no toolbar of its own', leisten === 0, leisten);

    pruefe('the board raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a board exists in the data', false, 'keines gefunden');
  }

  /* ---- Begegnung, Initiative, Würfel (REQ-070, 085, 115, 144) ---- */
  const kampf = await p.evaluate(() => {
    const k = [...window.__T__.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Encounter');
    return k ? (k.name || (k.components.Imported || {}).text) : null;
  });
  if (kampf) {
    await oeffne(kampf);
    await p.waitForTimeout(600);
    const lies = () => p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.initt tr')].slice(1).map((r) => ({
        cls: r.className,
        who: r.children[2]?.textContent ?? '',
        init: r.querySelectorAll('input')[0]?.value ?? '',
        hp: r.querySelectorAll('input')[1]?.value ?? '' })),
      runde: document.querySelector('.fight .pill')?.textContent ?? '',
      karte: document.querySelectorAll('.fight .mapimg').length,
      ring: document.querySelectorAll('.mtoken.now').length,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    const vor = await lies();
    pruefe('every fighter is a row of its own', vor.zeilen.length >= 4, vor.zeilen.length);
    /* Drei Goblins aus einem Statblock heissen drei Zeilen mit eigenen
       Trefferpunkten — eine Zahl an einer Kante könnte nur einen verletzen. */
    const doppelt = vor.zeilen.filter((z) => /Kanalschleim/.test(z.who));
    pruefe('two of the same statblock have hit points of their own',
      doppelt.length === 2 && doppelt.every((z) => z.hp !== ''), doppelt);
    pruefe('the fight shows the map it happens on', vor.karte === 1, vor.karte);
    pruefe('the encounter validates clean', vor.probleme.length === 0, vor.probleme);

    await p.evaluate(() =>
      [...document.querySelectorAll('.maptools button')].find((b) => /Roll initiative/.test(b.textContent)).click());
    await p.waitForTimeout(500);
    const nachWurf = await lies();
    pruefe('rolling initiative fills every row and starts round one',
      nachWurf.zeilen.every((z) => z.init !== '') && /Round 1/.test(nachWurf.runde), nachWurf.runde);
    /* Sortiert wird absteigend — und zwar sichtbar, sonst rechnet es am
       Tisch jemand im Kopf nach und kommt auf etwas anderes. */
    const werte = nachWurf.zeilen.map((z) => Number(z.init));
    pruefe('the order is highest initiative first',
      werte.every((v, i) => i === 0 || werte[i - 1] >= v), werte);
    pruefe('exactly one row has the turn',
      nachWurf.zeilen.filter((z) => /now/.test(z.cls)).length === 1,
      nachWurf.zeilen.map((z) => z.cls));

    /* Der Wurfverlauf zeigt die Einzelwürfe — „18" und „1+17" sind am Tisch
       zweierlei, und ein Wurf, der „undefined" anzeigt, glaubt niemand. */
    const verlauf = await p.evaluate(() =>
      [...document.querySelectorAll('.rollrow .rv')].map((x) => x.textContent));
    pruefe('the dice log shows the individual rolls',
      verlauf.length >= 4 && verlauf.every((t) => !/undefined|NaN/.test(t)), verlauf);

    const wer = nachWurf.zeilen.find((z) => /now/.test(z.cls));
    await p.evaluate(() =>
      [...document.querySelectorAll('.maptools button')].find((b) => /Next turn/.test(b.textContent)).click());
    await p.waitForTimeout(500);
    const nachZug = await lies();
    const wer2 = nachZug.zeilen.find((z) => /now/.test(z.cls));
    pruefe('the turn moves on', wer2 && wer2.who !== wer.who, { wer: wer.who, wer2: wer2 && wer2.who });

    /* Ein freier Ausdruck darf kein `eval` sein und muss bei Unsinn nein
       sagen, statt eine plausible Zahl zu erfinden. */
    const wuerfel = await p.evaluate(() => {
      const f = window.__T__;
      return {
        gut: f.rollDice('2d6+3'),
        einzeln: f.rollDice('1d1'),
        unsinn: f.rollDice('zwei Äpfel'),
        leer: f.rollDice(''),
      };
    });
    pruefe('the dice roller reads an expression and refuses nonsense',
      wuerfel.gut && wuerfel.gut.total >= 5 && wuerfel.gut.total <= 15
      && wuerfel.einzeln.total === 1
      && wuerfel.unsinn === null && wuerfel.leer === null, wuerfel);

    pruefe('the fight raised no exception', errs.length === 0, errs);
  } else {
    pruefe('an encounter exists in the data', false, 'keine gefunden');
  }

  /* ---- Aufträge und Zeitleiste (REQ-082, 083, 106) ---- */
  const auftrag = await p.evaluate(() => {
    const q = [...window.__T__.ENT.values()].find((e) =>
      (e.interfaces || [])[0] === 'Quest'
      && Array.isArray(((e.components || {}).Quest || {}).tasks)
      && e.components.Quest.tasks.length > 2);
    /* Das Brett und die Zeitleiste gehören der **Kampagne**: beides sind
       Fragen an ihr Ganzes und keine Eigenschaft einer Gruppe. Vorher war
       der Träger beliebig, weil jede Ansicht auf jedem Artikel stand. */
    const traeger = [...window.__T__.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Campaign');
    return {
      q: q ? (q.name || (q.components.Imported || {}).text) : null,
      p: traeger ? (traeger.name || (traeger.components.Imported || {}).text) : null,
    };
  });
  if (auftrag.q && auftrag.p) {
    await oeffne(auftrag.q);
    await p.waitForTimeout(450);
    const qs = await p.evaluate(() => ({
      kopf: [...document.querySelectorAll('.crhead .pill')].map((x) => x.textContent),
      offen: [...document.querySelectorAll('.task')].filter((t) => !t.querySelector('input').checked).length,
      erledigt: [...document.querySelectorAll('.task.done')].length,
      /* [[Verweise]] in einer Aufgabe lösen sich auf wie überall sonst —
         eine Aufgabe, die auf etwas zeigt, soll dorthin führen. */
      refs: document.querySelectorAll('.task .ref').length,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('a quest shows state, reward and deadline', qs.kopf.length >= 3, qs.kopf);
    pruefe('tasks tick off and links inside them resolve',
      qs.offen > 0 && qs.erledigt > 0 && qs.refs > 0, qs);
    pruefe('the quest validates clean', qs.probleme.length === 0, qs.probleme);

    const zahl = await p.evaluate(() =>
      [...document.querySelectorAll('.task')].filter((t) => !t.querySelector('input').checked).length);
    await p.evaluate(() =>
      [...document.querySelectorAll('.task')].find((t) => !t.querySelector('input').checked)
        .querySelector('input').click());
    await p.waitForTimeout(450);
    const danach = await p.evaluate(() =>
      [...document.querySelectorAll('.task')].filter((t) => !t.querySelector('input').checked).length);
    pruefe('ticking a task is stored', danach === zahl - 1, { zahl, danach });

    await oeffne(auftrag.p);
    await p.waitForTimeout(450);
    const brett = await p.evaluate(() => ({
      abschnitte: [...document.querySelectorAll('.quests .sec')].map((x) => x.textContent),
      zeilen: [...document.querySelectorAll('.qrow')].map((r) => r.textContent),
    }));
    pruefe('the quest board groups by state',
      brett.abschnitte.length >= 2 && brett.zeilen.length >= 2, brett.abschnitte);
    pruefe('the board counts the tasks per quest',
      brett.zeilen.some((z) => /\d+\/\d+ tasks/.test(z)), brett.zeilen);

    await p.waitForTimeout(450);
    const zeit = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.tl')].map((r) => ({
        d: r.querySelector('.tdate').textContent,
        n: r.querySelector('.ref').textContent })),
      sortiert: [...window.__T__.ENT.values()]
        .filter((e) => ((e.components || {}).Time || {}).sort !== undefined)
        .map((e) => Number(e.components.Time.sort)),
    }));
    pruefe('the timeline lists everything that carries a world date',
      zeit.zeilen.length >= 4, zeit.zeilen.length);
    /* Sortiert wird nach `sort`, gelesen `display` — deshalb stehen beide im
       Schema. „Mirtul 12, 1492 TZ" lässt sich nicht vergleichen. */
    const gelesen = zeit.zeilen.map((z) => z.d);
    pruefe('the timeline reads the display date and orders by the sortable one',
      gelesen.some((d) => /[A-Za-z]/.test(d))
      && gelesen[0] !== gelesen[gelesen.length - 1], gelesen);
    pruefe('quests and timeline raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a quest with tasks and a party exist in the data', false, auftrag);
  }

  /* ---- Zugang und Spieleransicht (REQ-031 bis 040, 119, 128) ----
     Der Prüfstein: zwei Charaktere, dasselbe Rezept, verschiedene Seiten.
     Gilt der Filter nur für die Blöcke oder nur für die Felder, sieht man es
     an einer einzelnen Ansicht nicht — erst im Vergleich. */
  const paar2 = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const rec = alle.find((e) => (e.interfaces || [])[0] === 'Recipe'
      && (e.relations || []).some((r) => r.type === 'knowledge'));
    const info = rec && window.__T__.ENT.get(
      rec.relations.find((r) => r.type === 'knowledge').to);
    const kenner = info && (info.relations || []).find((r) => r.type === 'knownBy');
    const pcs = alle.filter((e) => (e.interfaces || [])[0] === 'PlayerCharacter');
    const fremd = pcs.find((e) => !kenner || e.id !== kenner.to);
    return {
      rec: rec ? (rec.name || (rec.components.Imported || {}).text) : null,
      kennerId: kenner ? kenner.to : null,
      fremdId: fremd ? fremd.id : null,
    };
  });
  if (paar2.rec && paar2.kennerId && paar2.fremdId) {
    await oeffne(paar2.rec);
    await p.waitForTimeout(400);
    const sicht = async (id) => {
      await p.evaluate((v) => {
        const s2 = document.getElementById('asview');
        s2.value = v;
        s2.dispatchEvent(new Event('change', { bubbles: true }));
      }, id);
      await p.waitForTimeout(450);
      return p.evaluate(() => ({
        felder: [...document.querySelectorAll('.fld dt')].map((x) => x.textContent),
        bloecke: [...document.querySelectorAll('.blk .bl')].map((x) => x.textContent.replace('×', '')),
        rail: [...document.querySelectorAll('.rail h3')].map((x) => x.textContent),
        seiten: [...document.querySelectorAll('#pages button')].map((x) => x.textContent),
      }));
    };
    const alsGM = await sicht('');
    const alsKenner = await sicht(paar2.kennerId);
    const alsFremd = await sicht(paar2.fremdId);

    pruefe('the GM sees everything',
      alsGM.bloecke.includes('Secrets') && alsGM.felder.length > alsFremd.felder.length, alsGM);
    /* Wer die Information kennt, sieht ihre Felder und ihre Textstelle —
       auch wenn sie im Feld `secret` steht: eine ausdrückliche Freigabe
       schlägt die Voreinstellung, sonst wäre jede Freigabe wirkungslos. */
    pruefe('a granted secret passage reaches the one who knows it',
      alsKenner.bloecke.includes('Secrets') && !alsFremd.bloecke.includes('Secrets'),
      { alsKenner: alsKenner.bloecke, alsFremd: alsFremd.bloecke });
    /* Die Fussnote „Not yours yet" ist kein Feld, sondern die Auskunft,
       dass eines fehlt (REQ-179) — sie zählt hier nicht mit. */
    const ohneFussnote = alsFremd.felder.filter((f) => f !== 'Not yours yet');
    pruefe('a field of an unknown information is gone for the other one',
      alsKenner.felder.length > ohneFussnote.length
      && ohneFussnote.every((f) => alsKenner.felder.includes(f))
      && alsFremd.felder.includes('Not yours yet'),
      { alsKenner: alsKenner.felder, alsFremd: alsFremd.felder });
    /* Für einen Spieler gibt es kein Register. Auszugrauen wäre eine
       Einladung; wegzulassen ist die Antwort. Seit es sechs Seiten gibt,
       fällt die ganze Seite weg und nicht ein Abschnitt in der Leiste. */
    pruefe('a player gets no registry page',
      alsGM.seiten.includes('Registry') && !alsFremd.seiten.includes('Registry')
      && alsFremd.seiten.includes('Compendium'),
      { alsGM: alsGM.seiten, alsFremd: alsFremd.seiten });

    const zugesperrt = await p.evaluate(() => {
      window.__T__.UI.route = { k: 'reg' };
      return null;
    });
    await zurSeite(p, 'Compendium');
    await p.evaluate(() => {
      const b2 = [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent));
      if (b2) b2.click();
    });
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      const s2 = document.getElementById('asview');
      s2.value = '';
      s2.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(350);
    pruefe('the viewing-as switch goes back to the GM',
      await p.evaluate(() => !document.body.classList.contains('asplayer')), zugesperrt);
    pruefe('the player view raised no exception', errs.length === 0, errs);
  } else {
    pruefe('two characters and a guarded recipe exist in the data', false, paar2);
  }

  /* ---- Der Tisch in Echtzeit (REQ-071, 116, 117) ----
     Die Trennlinie ist das Prüfbare: was bleibt, geht in den Speicher; was
     ein Augenblick ist, in den Kanal. Ginge der laufende Kampf über den
     Kanal, sähe ihn niemand, der zehn Minuten später dazukommt — und das
     merkte man erst am Tisch. */
  const sitzung = await p.evaluate(() => {
    const se = [...window.__T__.ENT.values()].find((e) => (e.components || {}).Session);
    return se ? (se.name || s(e.components.Imported || {}).text) : null;
  });
  if (sitzung) {
    await oeffne(sitzung);
    await p.waitForTimeout(450);
    const lv = await p.evaluate(() => ({
      abschnitte: [...document.querySelectorAll('.live .sec')].map((x) => x.textContent),
      bezuege: [...document.querySelectorAll('.live .relrow .rl')].map((x) => x.textContent),
      verweise: [...document.querySelectorAll('.live .relrow .ref')].map((x) => x.textContent),
      anwesend: [...document.querySelectorAll('.live .chip.peer b')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the live view shows what is in play',
      lv.bezuege.includes('Fight') && lv.bezuege.includes('Map') && lv.verweise.length >= 2, lv);
    pruefe('the session validates clean', lv.probleme.length === 0, lv.probleme);

    /* Anwesenheit kommt vom Kanal und beschreibt nur den Absender. */
    await p.evaluate(() => window.__ROOM__.setPeers([
      { isMe: true, presence: { gm: true, title: 'Sitzung 12' } },
      { isMe: false, presence: { actor: null, gm: false, title: 'Kerzengasse' } },
    ]));
    await p.waitForTimeout(350);
    const wer = await p.evaluate(() =>
      [...document.querySelectorAll('.live .chip.peer')].map((c) => c.textContent));
    pruefe('who is at the table comes from the channel', wer.length === 2, wer);

    /* Ein geteilter Wurf: gesendet und — als käme er von jemand anderem —
       gehört. Nur eine Richtung zu prüfen hiesse, die halbe Leitung zu
       prüfen. */
    await p.evaluate(() => { window.__EMITS__.length = 0; });
    await p.evaluate(() =>
      [...document.querySelectorAll('.live .btn.dice')][0].click());
    await p.waitForTimeout(400);
    const gesendet = await p.evaluate(() => window.__EMITS__.slice());
    pruefe('a shared roll goes out on the channel',
      gesendet.length === 1 && gesendet[0].t === 'roll' && !!gesendet[0].d.text, gesendet);

    await p.evaluate(() => window.__ROOM__.fire('roll',
      { who: 'Sela Kerzendocht', what: '1d20+2', total: 17, text: '17  (15 +2)' }));
    await p.waitForTimeout(350);
    const gehoert = await p.evaluate(() =>
      [...document.querySelectorAll('.live .rollrow')].map((r) => r.textContent));
    pruefe('a roll from someone else arrives with their name and their numbers',
      gehoert.some((t) => /Sela/.test(t) && /17/.test(t) && /15 \+2/.test(t)), gehoert);

    /* Das Zeigen auf die Karte: es steht nirgends und muss es auch nicht. */
    await p.evaluate(() => window.__ROOM__.fire('ping',
      { id: 'pg_test', map: 'mp_kerzengasse', x: 0.5, y: 0.5, who: 'Sela' }));
    await p.waitForTimeout(300);
    await oeffne('Karte: Kerzengasse');
    await p.waitForTimeout(450);
    const zeiger = await p.evaluate(() =>
      [...document.querySelectorAll('.mping')].map((n) => n.textContent));
    pruefe('pointing at a spot shows up on the map', zeiger.length === 1 && /Sela/.test(zeiger[0]), zeiger);

    /* Anwesenheit wird beim Wechsel gemeldet, nicht nur beim Start. */
    const gemeldet = await p.evaluate(() => window.__PRESENCE__.slice(-1)[0] || null);
    pruefe('presence says what this viewer is looking at',
      gemeldet && gemeldet.at === 'art' && !!gemeldet.article, gemeldet);
    pruefe('the live channel raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a session with a live state exists in the data', false, 'keine gefunden');
  }

  /* ---- Tabellen (REQ-085, 125, 172, 186) ----
     Drei Dinge, die eine Tabelle von einer Liste unterscheiden: die
     Bereiche werden gerechnet, eine Tabelle darf in einer stehen, und ein
     Eintrag kann an einen Ort gebunden sein. Alle drei sind prüfbar, und
     alle drei gehen still kaputt, wenn niemand sie prüft. */
  const tabelle = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const t = alle.find((e) => (e.interfaces || [])[0] === 'Table'
      && (e.relations || []).some((r) => {
        const z = window.__T__.ENT.get(r.to);
        return r.type === 'entry' && z && (z.interfaces || [])[0] === 'Table';
      }));
    const ort = alle.find((e) => (e.relations || []).some((r) => r.type === 'tableFor')
      && (e.interfaces || [])[0] !== 'Encounter');
    return { t: t ? t.id : null, ort: ort ? ort.id : null };
  });
  if (tabelle.t && tabelle.ort) {
    await oeffneId(tabelle.t);
    await p.waitForTimeout(450);
    const tb = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.tablebox table tr')].slice(1)
        .map((r) => [...r.children].map((c) => c.textContent)),
      kopf: [...document.querySelectorAll('.tablebox table th')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the table validates clean', tb.probleme.length === 0, tb.probleme);
    /* Die Bereiche sind gerechnet und lückenlos: 1–3, 4–5, 6–9, 10. Von
       Hand geführt bricht das, sobald jemand eine Zeile einfügt. */
    const bereiche = tb.zeilen.map((z) => z[0]);
    const grenzen = bereiche.map((b) => b.split('–').map(Number));
    pruefe('the ranges are computed and leave no gap',
      grenzen[0][0] === 1
      && grenzen.every((g, i) => i === 0 || g[0] === (grenzen[i - 1][1] || grenzen[i - 1][0]) + 1),
      bereiche);
    pruefe('a nested table is marked as one',
      tb.zeilen.some((z) => /a table/.test(z[1])), tb.zeilen.map((z) => z[1]));
    pruefe('a conditional entry says what it asks for',
      tb.zeilen.some((z) => /^#/.test(z[3])), tb.zeilen.map((z) => z[3]));

    /* Auf dem Ort gilt der Zusammenhang: ein Eintrag mit Marke kommt nur
       dort in den Topf — und eine verschachtelte Tabelle würfelt weiter. */
    await oeffneId(tabelle.ort);
    await p.waitForTimeout(450);
    const knopf = await p.evaluate(() =>
      [...document.querySelectorAll('.tablebox .btn')].map((b) => b.textContent));
    pruefe('a place rolls on the table that applies there',
      knopf.some((t) => /^Roll /.test(t)), knopf);
    await p.evaluate(() => { window.__T__.UI.rollLog.length = 0; });
    await p.evaluate(() =>
      [...document.querySelectorAll('.tablebox .btn')].find((b) => /^Roll /.test(b.textContent)).click());
    await p.waitForTimeout(300);
    const einWurf = await p.evaluate(() =>
      [...document.querySelectorAll('.rollrow .rv')].map((x) => x.textContent));
    pruefe('the button on the place produces a result', einWurf.length > 0, einWurf);
    /* **Einmal drücken heisst einmal würfeln.** Es stand dreimal da: einmal
       protokolliert, einmal über `shareRoll` noch einmal protokolliert, und
       einmal, weil der Raum Gesendetes auch dem Absender wieder einspielt.
       Drei Zeilen für einen Wurf — und am Tisch fragt dann jemand, welche
       davon gilt. */
    const einmal = await p.evaluate(() => window.__T__.UI.rollLog.length);
    pruefe('pressing it once rolls once', einmal === 1, einmal);

    /* Der Zusammenhang wird zweihundertmal geprüft und nicht sechsmal: ein
       Eintrag mit 20 % Gewicht taucht in sechs Würfen manchmal nicht auf,
       und eine Prüfung, die manchmal rot wird, glaubt bald niemand mehr. */
    const probe = await p.evaluate((ids) => {
      const T = window.__T__;
      const tab = T.ENT.get(ids.t), ort = T.ENT.get(ids.ort);
      /* Ein Zusammenhang ohne Marken — und die stehen seit der Zerlegung
         am Bestandteil `Tags` und nicht an der Entität. */
      const ohne = { id: 'ctx_leer', components: {} };
      const zaehl = (ctx) => {
        const o = { treffer: 0, kaputt: 0, leer: 0 };
        for (let i = 0; i < 200; i++) {
          const r = T.rollTable(tab, ctx);
          if (!r || !r.text || /undefined|NaN|loops back/.test(r.text)) o.kaputt++;
          else if (r.empty) o.leer++;
          else if (/→/.test(r.text)) o.treffer++;
        }
        return o;
      };
      return { mit: zaehl(ort), ohne: zaehl(ohne) };
    }, tabelle);
    pruefe('a conditional entry only comes up where its tag is',
      probe.mit.treffer > 0 && probe.ohne.treffer === 0, probe);
    pruefe('no roll came back empty or broken',
      probe.mit.kaputt === 0 && probe.ohne.kaputt === 0, probe);
    pruefe('tables raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a nested table and a place that uses one exist in the data', false, tabelle);
  }

  /* ---- Vorbereitung (REQ-078, 084, 188, 189, 190) ----
     Der Prüfstein: nichts davon ist zusätzlich gespeichert. Das Cockpit
     liest Kanten, die es ohnehin gibt; die Unfertigen sind der Stand; die
     offenen Punkte stehen an den Artikeln, zu denen sie gehören. Eine
     eigene Tabelle „Vorbereitung" wäre eine zweite Wahrheit. */
  const vorbereitung = await p.evaluate(() => {
    const e = [...window.__T__.ENT.values()].find((x) =>
      (((x.components || {}).Todos || {}).items || []).length > 1
      && (x.relations || []).length > 1);
    return e ? e.id : null;
  });
  if (vorbereitung) {
    await oeffneId(vorbereitung);
    await p.waitForTimeout(500);
    const pv = await p.evaluate(() => ({
      abschnitte: [...document.querySelectorAll('.prep .sec')].map((x) => x.textContent),
      cockpit: [...document.querySelectorAll('.cgroup .ck')].map((x) => x.textContent),
      offen: [...document.querySelectorAll('.prep .task')].filter((t) => !t.querySelector('input').checked).length,
      erledigt: [...document.querySelectorAll('.prep .task.done')].length,
      anderswo: document.querySelectorAll('.prep .qlist')[0]?.children.length ?? 0,
      unfertig: document.querySelectorAll('.prep .qlist')[1]?.children.length ?? 0,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the prep board has its four lists', pv.abschnitte.length === 4, pv.abschnitte);
    /* Die Gruppen des Cockpits sind Kantenarten, nicht erfundene Rubriken. */
    pruefe('the cockpit groups by the relation that leads there',
      pv.cockpit.length >= 2, pv.cockpit);
    pruefe('open and done are told apart', pv.offen > 0 && pv.erledigt > 0, pv);
    pruefe('open points from other articles are gathered', pv.anderswo > 0, pv.anderswo);
    pruefe('what is still idea or planned is listed', pv.unfertig > 0, pv.unfertig);
    pruefe('the prep board validates clean', pv.probleme.length === 0, pv.probleme);

    /* Schnellerfassung: ein Satz, Enter, fertig — ohne die Ansicht zu
       verlassen. Wer dafür springen muss, notiert es nicht. */
    await p.evaluate(() => {
      const i = document.querySelector('.prep .addbar.quick input');
      i.value = 'Probe: das hier notiert der Prüflauf';
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await p.waitForTimeout(500);
    const danach2 = await p.evaluate(() => ({
      offen: [...document.querySelectorAll('.prep .task')].filter((t) => !t.querySelector('input').checked).length,
      text: [...document.querySelectorAll('.prep .task')].map((t) => t.textContent).join(' '),
    }));
    pruefe('quick capture files a note without leaving the view',
      danach2.offen === pv.offen + 1 && /Prüflauf/.test(danach2.text), danach2);

    /* Den Stand gleich in der Liste ändern: wer dafür hinspringen muss,
       lässt ihn stehen, und die Liste wird zur Tapete. */
    const vorStand = await p.evaluate(() =>
      document.querySelectorAll('.prep .qlist')[1]?.children.length ?? 0);
    await p.evaluate(() => {
      const sel = document.querySelectorAll('.prep .qlist')[1].querySelector('select');
      sel.value = 'used';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(500);
    const nachStand = await p.evaluate(() =>
      document.querySelectorAll('.prep .qlist')[1]?.children.length ?? 0);
    pruefe('the status changes right in the list', nachStand === vorStand - 1,
      { vorStand, nachStand });
    pruefe('the prep board raised no exception', errs.length === 0, errs);
  } else {
    pruefe('an article with notes and relations exists in the data', false, 'keiner gefunden');
  }

  /* ---- Sicherung (REQ-029, 155, 191, 192) ----
     Der Grund steht in der alten App: ein misslungener Ladevorgang wurde
     von der nächsten Selbstspeicherung überschrieben, und der unlesbare
     Stand war danach weg. Die Prüfung dafür muss den Fehler wirklich
     auslösen — „es sieht richtig aus" hat damals auch gereicht. */
  await zumRegister(p, 'Backup');
  await p.evaluate(() => { window.__SAVED__.length = 0; });
  await p.evaluate(() =>
    [...document.querySelectorAll('#view .btn')].find((b) => /Download a backup/.test(b.textContent)).click());
  await p.waitForTimeout(450);
  const sicherung = await p.evaluate(() => {
    const s2 = window.__SAVED__[0];
    if (!s2) return null;
    let d = null;
    try { d = JSON.parse(s2.data); } catch (x) { return { parse: String(x) }; }
    return {
      name: s2.filename,
      format: d.format,
      teile: Object.keys(d.registry || {}),
      artikel: (d.entities || []).length,
      hier: window.__T__.ENT.size,
    };
  });
  pruefe('a backup carries the registry and every article',
    sicherung && sicherung.format === 'nebelwacht/1'
    && sicherung.artikel === sicherung.hier
    /* Genannt und nicht gezählt: eine Zahl wird beim nächsten Teil rot,
       ohne zu sagen, welcher fehlt. Die Einheiten und die Aufzählungen
       kamen dazu — eine Sicherung ohne sie liess sich zurücklesen und
       hatte danach keine Masse mehr. */
    && ['interfaces', 'relations', 'views', 'units', 'enums', 'vars', 'settings']
      .every((t) => sicherung.teile.includes(t))
    && /\.json$/.test(sicherung.name), sicherung);

  /* **Eine Datei mit Register und ohne Artikel** bringt die Zeilen und
     lässt den Bestand in Ruhe. Das Register wandert häufiger als die
     Artikel; dafür den ganzen Bestand aus- und wieder einzulesen ist ein
     Umweg, auf dem man einen Artikel verlieren kann. */
  const nurZeilen = await p.evaluate(() => {
    const T = window.__T__;
    const vorher = T.ENT.size;
    const datei = {
      format: 'nebelwacht/1',
      registry: { enums: { ...T.REG.enums, Probe: { name: 'Probe', label: 'Probe', values: ['eins'] } } },
    };
    const bericht = T.importReport(datei);
    return { bericht, vorher, artikel: bericht.neu + bericht.geaendert + bericht.gleich };
  });
  pruefe('a file with rows and no articles is a registry delivery',
    nurZeilen.bericht.ok && nurZeilen.bericht.nurRegister === true
    && nurZeilen.artikel === 0 && nurZeilen.bericht.weg === 0, nurZeilen.bericht);
  const angewandt = await p.evaluate(async () => {
    const T = window.__T__;
    const vorher = T.ENT.size;
    const datei = {
      format: 'nebelwacht/1',
      registry: { enums: { ...T.REG.enums, Probe: { name: 'Probe', label: 'Probe', values: ['eins'] } } },
    };
    T.applyImport(datei, true, function () {});
    await new Promise((r) => setTimeout(r, 300));
    const jetzt = { artikel: T.ENT.size, probe: !!(T.REG.enums || {}).Probe,
      abilityDa: !!(T.REG.enums || {}).Ability };
    delete T.REG.enums.Probe;
    return { vorher, ...jetzt };
  });
  /* Auch mit „und lösche, was nicht in der Datei steht": eine Datei ohne
     Artikel sagt nichts über Artikel. */
  pruefe('and it leaves every article alone, even with “remove the rest” ticked',
    angewandt.artikel === angewandt.vorher && angewandt.probe && angewandt.abilityDa,
    angewandt);

  /* Der Trockenlauf sagt, was passieren würde — eine Wiederherstellung ohne
     Vorschau ist ein zweiter Datenverlust mit Anlauf. */
  const trocken = await p.evaluate(() => {
    const T = window.__T__;
    const st = T.exportState();
    st.entities.push({ id: 'x_probe', interfaces: ['Article'], name: 'Probe',
      tags: [], components: { Name: { text: 'Probe' } }, relations: [] });
    st.entities[0] = Object.assign({}, st.entities[0], { name: 'Anders' });
    const weg = Object.assign({}, st, { entities: st.entities.slice(2) });
    return {
      gut: T.importReport(st),
      fehlend: T.importReport(weg),
      kaputt: T.importReport({ format: 'anders/1' }),
      keinObjekt: T.importReport('nein'),
    };
  });
  pruefe('the dry run counts new, changed and unchanged',
    trocken.gut.ok && trocken.gut.neu === 1 && trocken.gut.geaendert === 1
    && trocken.gut.gleich > 0, trocken.gut);
  pruefe('the dry run says what a restore would remove',
    trocken.fehlend.weg >= 2, trocken.fehlend);
  pruefe('a file that is not a backup is refused with reasons',
    !trocken.kaputt.ok && trocken.kaputt.fehler.length >= 2
    && !trocken.keinObjekt.ok, trocken);

  /* Fail-closed: nach einem kaputten Ladevorgang wird nicht geschrieben. */
  const vorSchreib = await p.evaluate(() => window.__WROTE__.length);
  await p.evaluate(() => window.__T__.breakLoad('the registry part “views” failed (test).'));
  await zurSeite(p, 'Compendium');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('#view .row')][0].click());
  await p.waitForTimeout(300);
  await p.evaluate(() => { const h = document.querySelector('.arthead h2'); if (h) h.click(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const i = document.querySelector('.arthead input');
    if (i) { i.value = 'Darf nicht gespeichert werden'; i.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await p.waitForTimeout(400);
  const zu = await p.evaluate((v) => ({
    geschrieben: window.__WROTE__.length - v,
    banner: document.querySelector('#view .banner')?.textContent ?? '',
  }), vorSchreib);
  pruefe('after a failed load nothing is written any more',
    zu.geschrieben === 0 && /Nothing is being saved/.test(zu.banner), zu);
  /* Und die Sicherung geht trotzdem — gerade dann. */
  await zumRegister(p, 'Backup');
  await p.evaluate(() => { window.__SAVED__.length = 0; });
  await p.evaluate(() =>
    [...document.querySelectorAll('#view .btn')].find((b) => /Download a backup/.test(b.textContent)).click());
  await p.waitForTimeout(450);
  const trotzdem = await p.evaluate(() => window.__SAVED__.length);
  pruefe('the backup still works while writing is closed', trotzdem === 1, trotzdem);
  pruefe('the backup raised no exception', errs.length === 0, errs);

  /* Der Prüflauf darf nicht mit geschlossenem Schreibweg weitergehen. */
  await p.evaluate(() => window.__T__.breakLoad(''));
  await p.waitForTimeout(200);

  /* ---- Deckname und bekannte Unbekannte (REQ-178, 179) ----
     Beides sind Zugaben zum Wissensmodell, und beide sind genau dann etwas
     wert, wenn sie *unterschiedlich* ausfallen. Eine Prüfung an einer
     einzelnen Ansicht sähe nichts. */
  const deck = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const e = alle.find((x) => ((x.components || {}).Identity || {}).cover
      && (x.relations || []).some((r) => r.type === 'knowledge'));
    if (!e) return null;
    const info = window.__T__.ENT.get(
      e.relations.find((r) => r.type === 'knowledge').to);
    const kennt = info && (info.relations || []).find((r) => r.type === 'knownBy');
    const pcs = alle.filter((x) => (x.interfaces || [])[0] === 'PlayerCharacter');
    const fremd = pcs.find((x) => !kennt || x.id !== kennt.to);
    return { id: e.id, echt: e.name || (e.components.Imported || {}).text,
      cover: e.components.Identity.cover,
      kennerId: kennt ? kennt.to : null, fremdId: fremd ? fremd.id : null };
  });
  if (deck && deck.kennerId && deck.fremdId) {
    const sicht2 = async (v) => {
      await p.evaluate((x) => {
        const s2 = document.getElementById('asview');
        s2.value = x;
        s2.dispatchEvent(new Event('change', { bubbles: true }));
      }, v);
      await p.waitForTimeout(400);
      await p.evaluate((i) => window.__T__.go({ k: 'art', id: i }), deck.id);
      await p.waitForTimeout(300);
      await p.waitForTimeout(400);
      return p.evaluate(() => ({
        titel: document.querySelector('.arthead h2')?.textContent ?? null,
        zurueck: document.querySelector('.fld.withheld dd')?.textContent ?? null,
        letzte: [...document.querySelectorAll('.fld')].pop()?.className ?? '',
      }));
    };
    const gm2 = await sicht2('');
    const kenner2 = await sicht2(deck.kennerId);
    const fremd2 = await sicht2(deck.fremdId);
    pruefe('the GM and the one who knows see the real name',
      gm2.titel === deck.echt && kenner2.titel === deck.echt, { gm2, kenner2 });
    pruefe('everyone else sees the cover name',
      fremd2.titel === deck.cover, fremd2);
    /* Dass etwas fehlt, darf man wissen — was, nicht. */
    pruefe('a filtered view says how much it is withholding',
      /and \d+ more/.test(fremd2.zurueck || '') && gm2.zurueck === null, fremd2);
    pruefe('the note about it comes last, not in the middle',
      /withheld/.test(fremd2.letzte), fremd2.letzte);

    /* In der Liste gilt derselbe Name — sonst verriete ihn das Kompendium. */
    await zurSeite(p, 'Compendium');
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((b) => /All articles/.test(b.textContent)).click());
    await p.waitForTimeout(350);
    const inListe = await p.evaluate((c) =>
      [...document.querySelectorAll('#view .row .rn')].map((x) => x.textContent).includes(c), deck.cover);
    pruefe('the cover name holds in the compendium too', inListe, deck.cover);

    /* Ein Verweis muss trotzdem ankommen: aufgelöst wird gegen den
       gespeicherten Namen, nicht gegen den, der angezeigt wird. */
    const trifft = await p.evaluate((n) => window.__T__.findByName(n), deck.echt);
    pruefe('a link still resolves against the stored name', trifft === deck.id,
      { trifft, erwartet: deck.id });

    await p.evaluate(() => {
      const s2 = document.getElementById('asview');
      s2.value = '';
      s2.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(350);
    pruefe('cover names raised no exception', errs.length === 0, errs);
  } else {
    pruefe('an article with a cover name exists in the data', false, deck);
  }

  /* ---- Regeln (REQ-091, 098, 099, 175) ----
     Der Massstab ist REQ-098: unter fünf Sekunden. Prüfbar ist daran, dass
     der Text gleich dasteht und dass getippt wird, nicht geklickt. */
  const hatRegeln = await p.evaluate(() =>
    [...window.__T__.ENT.values()].filter((e) => (e.interfaces || [])[0] === 'Rule').length);
  if (hatRegeln >= 2) {
    /* Nach Regeln sucht man dort, wo die Regeln stehen: auf der
       Regelwerk-Seite. Der Einstieg lag im Register, und das Register ist
       nichts für Spieler — nachschlagen aber schon. */
    await zurSeite(p, 'Rules');
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((b) => /^Rules/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    const br = await p.evaluate(() => ({
      count: document.querySelector('#view .count')?.textContent ?? '',
      arten: [...document.querySelectorAll('#view .chips .chip')].map((x) => x.textContent),
      /* Der Text steht gleich da — das ist der ganze Punkt. */
      mitText: [...document.querySelectorAll('#view .rule')]
        .filter((r) => (r.querySelector('.rt')?.textContent || '').trim().length > 10).length,
      gesamt: document.querySelectorAll('#view .rule').length,
      /* Eine Regel mit `status: idea` darf leer sein — sie sagt, dass hier
         etwas nachzutragen ist, und steht auf der Vorbereitungsseite unter
         „Unfinished". Die Waffeneigenschaften sind so entstanden: aus dem
         Text `„finesse, leicht"` wurden Kanten, und die Regeln dahinter
         haben noch keinen Wortlaut. Sie zu erfinden hiesse, Regeltexte zu
         schreiben, die niemand geprüft hat. */
      unfertig: [...window.__T__.ENT.values()].filter((e) =>
        (e.interfaces || [])[0] === 'Rule'
        && ((e.components || {}).Status || {}).status === 'idea').length,
      nutzer: [...document.querySelectorAll('#view .rusers .ref')].map((x) => x.textContent),
    }));
    pruefe('the rules browser shows every finished rule with its text',
      br.gesamt >= 2 && br.mitText === br.gesamt - br.unfertig, br);
    pruefe('it groups by kind', br.arten.length >= 2, br.arten);
    /* Wer die Regel benutzt, ist der Rückbezug, den `composedOf` schon
       trägt — keine zweite Liste. */
    pruefe('it says who uses a rule', br.nutzer.length > 0, br.nutzer);

    /* Getippt wird ein Wortanfang, und die Liste wird schmaler. */
    const wort = await p.evaluate(() => {
      const n = document.querySelector('#view .rule .ref')?.textContent || '';
      return n.slice(0, 5).toLowerCase();
    });
    await p.evaluate((w) => {
      const i = document.querySelector('#view input[type=search]');
      i.value = w;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    }, wort);
    await p.waitForTimeout(300);
    const eng = await p.evaluate(() => ({
      count: document.querySelector('#view .count')?.textContent ?? '',
      erste: document.querySelector('#view .rule .ref')?.textContent ?? null,
    }));
    pruefe('typing narrows it down and puts the name match first',
      /^1 of /.test(eng.count) === false || eng.erste !== null,
      eng);
    pruefe('the search finds the rule it was typed for',
      (eng.erste || '').toLowerCase().indexOf(wort) === 0, { wort, eng });
    await p.evaluate(() => {
      const i = document.querySelector('#view input[type=search]');
      i.value = '';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(250);

    /* Der Merkzettel liegt im eigenen Bereich des Nutzers — einer, den
       alle sehen, ist keiner. */
    await p.evaluate(() => [...document.querySelectorAll('#view .rule .rk .btn')][0].click());
    await p.waitForTimeout(450);
    const pin = await p.evaluate(() => ({
      chips: [...document.querySelectorAll('.pinbar .chip')].map((x) => x.textContent),
      wohin: window.__WROTE__.filter((x) => /data\/users/.test(x)),
    }));
    pruefe('a pinned rule goes to the viewer’s own corner',
      pin.chips.length === 1 && pin.wohin.length > 0, pin);

    /* Verweise im Fliesstext: wo eine Regel beim Namen genannt wird, steht
       sie auch — und sie klappt an Ort und Stelle auf, weil Wegspringen und
       Zurückspringen zwei Schritte zu viel sind. */
    /* Gesucht ist ein Artikel, in dessen *gezeichnetem* Text ein Regelname
       vorkommt. Das ist nicht dasselbe wie „steht in seinen Feldern": ein
       Statblock zieht die Regeltexte über `composedOf` herein, und genau
       dort will man den Verweis. Deshalb wird der gezogene Text mitgesucht. */
    const mitProsa = await p.evaluate(() => {
      const T = window.__T__;
      const regeln = [...T.ENT.values()].filter((e) => (e.interfaces || [])[0] === 'Rule');
      const namen = regeln.map((e) => e.name || (e.components.Imported || {}).text)
        .filter((n) => n && n.length >= 4);
      /* Prosa ist die Beschreibung und die Textstellen — nicht der ganze
         Artikel. Der Name selbst zählt nicht: ein Artikel, der „Verzicht:
         Verstrickt" heisst, nennt keine Regel im Text, und ein Treffer
         darauf prüfte die Suche statt das Erkennen. */
      const prosa = (x) => {
        let t = ((x.components || {}).Description || {}).description || '';
        T.allProse(x).forEach((y) => { t += ' ' + (y.value || ''); });
        return t;
      };
      const textVon = (x) => {
        let t = prosa(x);
        (x.relations || []).forEach((r) => {
          const d = T.REG.relations[r.type];
          if (!d || !d.section) return;
          const z = T.ENT.get(r.to);
          if (z) t += ' ' + prosa(z);
        });
        return t;
      };
      const e = [...T.ENT.values()].find((x) =>
        (x.interfaces || [])[0] !== 'Rule' && T.articleVisible(x)
        && namen.some((n) => textVon(x).indexOf(n) >= 0));
      return e ? e.id : null;
    });
    if (mitProsa) {
      await oeffneId(mitProsa);
      await p.waitForTimeout(450);
      const inline2 = await p.evaluate(() =>
        [...document.querySelectorAll('.rulew')].map((x) => x.textContent));
      pruefe('a rule named in prose is marked', inline2.length > 0, inline2);
      await p.evaluate(() => { const w = document.querySelector('.rulew'); if (w) w.click(); });
      await p.waitForTimeout(300);
      const auf = await p.evaluate(() => {
        const n = document.querySelector('.rulepop');
        return n && n.style.display !== 'none' ? n.textContent : null;
      });
      pruefe('it opens where it stands instead of jumping away',
        !!auf && auf.length > 20, auf && auf.slice(0, 60));
    } else {
      pruefe('some article names a rule in its prose', false, 'keiner gefunden');
    }
    pruefe('the rules browser raised no exception', errs.length === 0, errs);
  } else {
    pruefe('rule elements exist in the data', false, hatRegeln);
  }

  /* ---- Punktreise (REQ-168 bis 171) ----
     Eine Punktreise ist ein Graph, keine Karte: von jedem Knoten geht es
     nur dorthin, wohin jemand einen Weg gelegt hat. Prüfbar ist daran, dass
     sich die Wege ändern, wenn die Gruppe weiterzieht — und dass Zeit und
     Zehrung dabei laufen. */
  const reise = await p.evaluate(() => {
    const T = window.__T__;
    const eltern = [...T.ENT.values()].find((e) => {
      if ((e.interfaces || [])[0] !== 'Place') return false;
      const kinder = [...T.ENT.values()].filter((o) =>
        (o.relations || []).some((r) => r.type === 'partOf' && r.to === e.id));
      return kinder.length >= 3
        && kinder.some((k) => (k.relations || []).some((r) => r.type === 'route'));
    });
    return eltern ? eltern.id : null;
  });
  if (reise) {
    await oeffneId(reise);
    await p.waitForTimeout(550);
    const lies2 = () => p.evaluate(() => ({
      kopf: [...document.querySelectorAll('.crawl .maptools .pill')].map((x) => x.textContent),
      spalten: [...document.querySelectorAll('.crcol')].map((c) => ({
        k: c.querySelector('.ck').textContent,
        n: [...c.querySelectorAll('.crnode b')].map((b) => b.textContent) })),
      hier: document.querySelector('.crnode.here b')?.textContent ?? null,
      wege: [...document.querySelectorAll('.crway .ck .ref')].map((x) => x.textContent),
      signale: [...document.querySelectorAll('.crway .cb')].length,
      handlungen: [...document.querySelectorAll('.cractions .rl')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    const vor2 = await lies2();
    pruefe('the crawl orders its nodes by distance from where you stand',
      vor2.spalten.length >= 2 && vor2.spalten[0].k === 'here'
      && vor2.spalten[0].n.length === 1, vor2.spalten);
    /* Der Sinneseindruck steht an der Kante: jeder Weg bringt seinen
       eigenen mit, und das ist der Unterschied zu einer Liste von Orten. */
    pruefe('every way carries its own sensory line',
      vor2.wege.length >= 2 && vor2.signale === vor2.wege.length,
      { wege: vor2.wege, signale: vor2.signale });
    pruefe('the crawl validates clean', vor2.probleme.length === 0, vor2.probleme);
    pruefe('each character gets one action at this node',
      vor2.handlungen.length >= 1, vor2.handlungen);
    /* Tag, Wache und Zehrung stehen da — sonst führt sie niemand nach. */
    pruefe('day, watch and provisions are on the bar',
      vor2.kopf.some((t) => /Day \d+, watch \d+/.test(t))
      && vor2.kopf.some((t) => /rations in/.test(t)), vor2.kopf);

    await p.evaluate(() =>
      [...document.querySelectorAll('.crway .btn')].find((b) => /Travel/.test(b.textContent)).click());
    await p.waitForTimeout(650);
    const nach2 = await lies2();
    pruefe('travelling moves the party and re-draws the ways',
      nach2.hier !== vor2.hier
      && JSON.stringify(nach2.wege) !== JSON.stringify(vor2.wege), { vor2: vor2.hier, nach2: nach2.hier });
    /* Ankommen deckt auf, wohin es weitergeht — sonst müsste die
       Spielleitung jede Kante von Hand freischalten und vergisst die
       halben. */
    pruefe('arriving reveals where it goes on from there',
      nach2.wege.length >= 2, nach2.wege);
    const zahl = (t) => { const m = /in (\d+)/.exec(t || ''); return m ? Number(m[1]) : null; };
    const vorR = zahl(vor2.kopf.find((t) => /rations in/.test(t)));
    const nachR = zahl(nach2.kopf.find((t) => /rations in/.test(t)));
    pruefe('a node of travel costs a watch and a step of provisions',
      nachR !== null && vorR !== null && nachR === vorR - 1
      && nach2.kopf.join() !== vor2.kopf.join(), { vorR, nachR });
    pruefe('the crawl raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a point-crawl exists in the data', false, 'keine gefunden');
  }

  /* ---- Ebenen und Stapel (REQ-004 bis 009, 044) ----
     Der Prüfstein ist, dass sich etwas *ändert*, wenn man eine Ebene
     umlegt. Eine Stapelanzeige, die immer dasselbe zeigt, ist eine
     Behauptung. */
  const stapel = await p.evaluate(() => {
    const T = window.__T__;
    const camp = [...T.ENT.values()].find((e) =>
      (e.relations || []).some((r) => r.type === 'activates'));
    const aus = [...T.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Layer'
      && !(camp?.relations || []).some((r) => r.type === 'activates' && r.to === e.id));
    const ersetzt = [...T.ENT.values()].find((e) =>
      (e.relations || []).some((r) => r.type === 'overrides'));
    return {
      camp: camp ? camp.id : null,
      aus: aus ? aus.id : null,
      neu: ersetzt ? ersetzt.id : null,
      alt: ersetzt ? ersetzt.relations.find((r) => r.type === 'overrides').to : null,
    };
  });
  if (stapel.camp && stapel.neu) {
    await oeffneId(stapel.camp);
    await p.waitForTimeout(550);
    const st3 = await p.evaluate(() => ({
      ebenen: [...document.querySelectorAll('.layer .ck .ref')].map((x) => x.textContent),
      nummern: [...document.querySelectorAll('.layer .num')].map((x) => Number(x.textContent)),
      ersetzt: [...document.querySelectorAll('.stackbox .chips .chip.warn')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the stack lists its layers bottom first',
      st3.ebenen.length >= 2
      && st3.nummern.every((n, i) => i === 0 || n === st3.nummern[i - 1] + 1), st3);
    pruefe('the stack names what a higher layer replaces',
      st3.ersetzt.length >= 1 && /→/.test(st3.ersetzt[0]), st3.ersetzt);
    pruefe('the stack validates clean', st3.probleme.length === 0, st3.probleme);

    /* Was ersetzt ist, ist weg — nicht durchgestrichen, sondern weg: eine
       Liste, die beide Fassungen zeigt, ist schlimmer als keine. */
    const beide = await p.evaluate((ids) => {
      const sichtbar = (id) => {
        const e = window.__T__.ENT.get(id);
        return !!e && window.__T__.articleVisible(e);
      };
      return { neu: sichtbar(ids.neu), alt: sichtbar(ids.alt) };
    }, stapel);
    pruefe('the replaced version is out and the replacing one is in',
      beide.neu === true && beide.alt === false, beide);

    /* Die Herkunft steht am Artikel, nicht in einem Register — die Frage
       stellt sich dort, wo man liest. */
    await oeffneId(stapel.neu);
    const herkunft = await p.evaluate(() =>
      [...document.querySelectorAll('.stackchip .chip')].map((x) => x.textContent));
    pruefe('an article says which layer it comes from', herkunft.length >= 1, herkunft);

    /* Und jetzt die Gegenprobe: eine Ebene aufschalten, die etwas
       herausnimmt, und nachsehen, dass es verschwindet. */
    if (stapel.aus) {
      const wegName = await p.evaluate((lid) => {
        const T = window.__T__;
        const opfer = [...T.ENT.values()].find((e) =>
          (e.relations || []).some((r) => r.type === 'inLayer' && r.to === lid
            && (r.props || {}).mode === 'removes'));
        return opfer ? opfer.id : null;
      }, stapel.aus);
      if (wegName) {
        const vorhin = await p.evaluate((id) => {
          const e = window.__T__.ENT.get(id);
          return !!e && window.__T__.articleVisible(e);
        }, wegName);
        await oeffneId(stapel.camp);
        await p.waitForTimeout(500);
        await p.evaluate((lid) => {
          const sel = [...document.querySelectorAll('.stackbox select')][0];
          sel.value = lid;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, stapel.aus);
        await p.waitForTimeout(600);
        const jetzt = await p.evaluate((id) => {
          const e = window.__T__.ENT.get(id);
          return !!e && window.__T__.articleVisible(e);
        }, wegName);
        pruefe('switching a layer on can take something out of play',
          vorhin === true && jetzt === false, { vorhin, jetzt });
        /* Und wieder ab: der Artikel ist zurück. Löschen wäre endgültig
           gewesen, Herausnehmen ist es nicht. */
        await p.evaluate(() => {
          const b2 = [...document.querySelectorAll('.layer .btn')].pop();
          if (b2) b2.click();
        });
        await p.waitForTimeout(600);
        const zurueck2 = await p.evaluate((id) => {
          const e = window.__T__.ENT.get(id);
          return !!e && window.__T__.articleVisible(e);
        }, wegName);
        pruefe('switching it off brings it back', zurueck2 === true, zurueck2);
      } else {
        pruefe('a layer that removes something exists in the data', false, stapel.aus);
      }
    }
    pruefe('the layer stack raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a campaign with layers exists in the data', false, stapel);
  }

  pruefe('knowledge needed no browser modal', modale.length === 0, modale);
  pruefe('no exception through the knowledge panel', errs.length === 0, errs);

  /* Die Ansicht wieder auf Schnell — eine Prüfung, die etwas aufmacht,
     räumt es auch weg. */
  await p.waitForTimeout(200);
  await p.close();
}

/* 3 — ohne Antwort: die Seite sagt, was ausblieb, statt still zu warten */
{
  const { p, errs } = await seite('stumm.html', 11000);
  const s = await p.evaluate(() => ({
    banner: document.querySelector('#view .banner')?.textContent ?? null,
    laedt: document.getElementById('view').innerText.trim() === 'Loading…',
  }));
  pruefe('watchdog banner appears', /No data received/.test(s.banner ?? ''), s);
  /* Die Zahl kommt aus der Liste der Teile und nicht aus dem Text: seit
     „Units" dazugehört, sind es sechs, und eine Prüfung, die eine Zahl
     abtippt, wird beim nächsten Teil rot, ohne etwas zu sagen. */
  pruefe('counts registry parts correctly',
    new RegExp('0 of \\d+ registry parts').test(s.banner ?? ''), s);
  pruefe('does not sit on Loading…', !s.laedt, s);
  pruefe('no exception without data', errs.length === 0, errs);
  await p.close();
}

await browser.close();
console.log(fehler ? `\n${fehler} check(s) failed.` : '\nAll checks passed.');
process.exit(fehler ? 1 : 0);

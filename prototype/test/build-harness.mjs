import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Pfade hängen an dieser Datei, nicht am Arbeitsverzeichnis. Vorher musste
   man aus genau einem Verzeichnis starten, und aus welchem stand nirgends —
   das kostete beim nächsten Anlauf eine Viertelstunde. */
const HIER = dirname(fileURLToPath(import.meta.url));
const dir = (d) => readdirSync(join(HIER, d)).filter((f) => f.endsWith('.json'));
const lies = (...t) => readFileSync(join(HIER, ...t), 'utf8');

const page = lies('..', 'nebelwacht-artikel.html');
const reg  = Object.fromEntries(dir('dbdump/registry').map((f) =>
  [f.replace(/\.json$/, ''), JSON.parse(lies('dbdump/registry', f))]));
const ent  = dir('dbdump/entities').map((f) => JSON.parse(lies('dbdump/entities', f)));

/* Der echte Speicher liefert eingefrorene Bodies ("Delivered snapshots and
   their data() are frozen"). Der Stub muss das nachbilden — sonst geht jede
   Mutation im Snapshot-Callback hier durch und bricht erst beim Nutzer. */
const STUB_LIVE = `
window.__REG__ = ${JSON.stringify(reg)};
window.__ENT__ = ${JSON.stringify(ent)};
window.__WROTE__ = [];
window.__DELETED__ = [];
function tiefKalt(o){
  if(o && typeof o==='object' && !Object.isFrozen(o)){
    Object.freeze(o);
    Object.keys(o).forEach(function(k){ tiefKalt(o[k]); });
  }
  return o;
}
tiefKalt(window.__REG__); tiefKalt(window.__ENT__);
/* Ein Raum-Stub: er prüft die Verdrahtung, nicht das Netz. Gesendetes landet
   in __EMITS__, und __ROOM__.fire() spielt ein Ereignis ein, als käme es von
   jemand anderem — ohne das liesse sich nur prüfen, dass etwas rausgeht, und
   nicht, was ankommt. */
window.__EMITS__ = [];
window.__SAVED__ = [];
window.__PRESENCE__ = [];
window.__ROOM__ = { handlers: {}, peers: [],
  fire: function(topic, data){ (this.handlers[topic]||[]).forEach(function(h){ h({data:data}); }); },
  setPeers: function(list){ this.peers = list; (this.handlers.__peers__||[]).forEach(function(h){ h(list); }); } };
window.claude = { use: async function(n){
  if(n==='user') return { can: async function(){ return true; },
    isOwner: async function(){ return true; }, id: async function(){ return 'u_test'; } };
  if(n==='downloads') return { save: async function(r){ window.__SAVED__.push(r); return {status:'saved'}; } };
  if(n==='room') return {
    /* Der echte Raum spielt Gesendetes auch dem Absender wieder ein
       („plus your own publishing session when admitted"). Ein Stub, der das
       verschweigt, lässt genau den Fehler durch, den es hier gab: derselbe
       Wurf stand dreimal im Protokoll. */
    emit: async function(t,d){ window.__EMITS__.push({t:t,d:d});
      setTimeout(function(){ window.__ROOM__.fire(t,d); },0); },
    on: function(t,h){ (window.__ROOM__.handlers[t]=window.__ROOM__.handlers[t]||[]).push(h);
      return function(){}; },
    presence: async function(p){ window.__PRESENCE__.push(p); },
    onPeers: function(h){ (window.__ROOM__.handlers.__peers__=window.__ROOM__.handlers.__peers__||[]).push(h);
      return function(){}; },
    peers: function(){ return window.__ROOM__.peers; } };
  if(n!=='db') return null;
  return {
    doc: function(path){ return {
      onSnapshot: function(next){ var part=path.split('/')[1];
        setTimeout(function(){ next(tiefKalt({exists:!!window.__REG__[part],
          data:function(){return window.__REG__[part];}})); },0);
        return function(){}; },
      set: async function(){ window.__WROTE__.push(path); },
      delete: async function(){ window.__DELETED__.push(path);
        window.__ENT__ = window.__ENT__.filter(function(d){ return 'entities/'+d.id !== path; }); } }; },
    collection: function(){ return { limit:function(){return this;},
      onSnapshot:function(next){
        setTimeout(function(){ next(tiefKalt({docs: window.__ENT__.map(function(d){
          return {id:d.id, exists:true, data:function(){return d;}}; })})); },0);
        return function(){}; } }; } }; } };
`;

const STUB_STUMM = `
window.claude = { use: async function(n){
  if(n==='user') return { can: async function(){ return true; } };
  if(n!=='db') return null;
  return { doc: function(){ return { onSnapshot: function(){ return function(){}; } }; },
    collection: function(){ return { limit:function(){return this;},
      onSnapshot:function(){ return function(){}; } }; } }; } };
`;

/* Die Seite kapselt alles in eine IIFE — richtig so, aber dann kommt der
   Prüflauf an nichts heran ausser dem DOM. Nur im Prüfaufbau wird ein Griff
   nach draussen gereicht, unmittelbar vor dem Schliessen der IIFE. Die
   veröffentlichte Seite hat ihn nicht. */
/* `ENT` wird beim Schnappschuss neu gesetzt (`ENT=neu`), nicht befüllt.
   Ein Griff, der die Map einmal festhält, zeigt darum für immer auf die
   leere vom Seitenanfang — und eine Prüfung, die daraus liest, findet
   nichts und sagt nicht warum. Deshalb Zugriffsfunktionen statt Werte. */
const GRIFF = `
window.__T__={derivedValue:derivedValue,assetSrc:assetSrc,UI:UI,
  LAYOUT_ELEMENTS:LAYOUT_ELEMENTS,rollDice:rollDice,go:go,rollTable:rollTable,
  exportState:exportState,importReport:importReport,findByName:findByName,
  articleVisible:articleVisible,activeStack:activeStack,
  breakLoad:function(t){ loadFailed=t||'the articles failed (test).'; },
  visionPoly:visionPoly,rayHit:rayHit,inShape:inShape,mapLights:mapLights,
  noteNat:noteNat,craftMod:craftMod,recipeDays:recipeDays,craftStatus:craftStatus,
  entryAnchor:entryAnchor,ensureAnchors:ensureAnchors,
  anchorlessProse:anchorlessProse,backfillAnchors:backfillAnchors,
  proseFields:proseFields,proseOf:proseOf,allProse:allProse,
  bundlesWith:bundlesWith,informationsIn:informationsIn,knowsInfo:knowsInfo,
  statsOf:statsOf,
  fieldsOf:fieldsOf,fieldTitle:fieldTitle,titleSource:titleSource,
  nextId:nextId,idPrefix:idPrefix,articleId:articleId,
  natFor:natFor,mapCard:mapCard,
  entriesOf:entriesOf,entryRef:entryRef,putEntry:putEntry,dropEntry:dropEntry,
  gmFields:gmFields,summary:summary,
  campaignVars:campaignVars,fillVars:fillVars,
  visibleRefs:visibleRefs,areaOf:areaOf,render:render,
  mapWalls:mapWalls,mapBarriers:mapBarriers,mapSheets:mapSheets,mapImage:mapImage,
  drawnSheets:drawnSheets,blocksSight:blocksSight,blocksMove:blocksMove,
  applyMapTool:applyMapTool,frameAt:frameAt,areaShare:areaShare,
  enumWerte:enumWerte,enumGruppen:enumGruppen,enumQuelle:enumQuelle,
  importReport:importReport,applyImport:applyImport,typeList:typeList,
  verlinkteTypen:verlinkteTypen,verlinkterArtikel:verlinkterArtikel,
  fieldInput:fieldInput,feldVorschlaege:feldVorschlaege,
  compsFor:compsFor,relsFrom:relsFrom,
  compOrigin:compOrigin,parentsOf:parentsOf,ancestorsOf:ancestorsOf,
  tagsOf:tagsOf,setTags:setTags,layoutOf:layoutOf,layoutSource:layoutSource,
  formatMeasure:formatMeasure,convertText:convertText,unitsFor:unitsFor,
  convertUnit:convertUnit,
  ifaceInList:ifaceInList};
Object.defineProperty(window.__T__,'REG',{get:function(){return REG;}});
Object.defineProperty(window.__T__,'ENT',{get:function(){return ENT;}});
`;
const mitGriff = page.replace(/\n\}\)\(\);\n<\/script>\s*$/, `${GRIFF}})();\n<\/script>\n`);
if (mitGriff === page) throw new Error('IIFE-Ende nicht gefunden — Seite umgebaut?');

const wrap = (stub) =>
  `<!doctype html><html><head><meta charset='utf-8'></head><body>\n<script>${stub}<\/script>\n${mitGriff}`;

mkdirSync(join(HIER, 'harness'), { recursive: true });
writeFileSync(join(HIER, 'harness/index.html'), wrap(STUB_LIVE));
writeFileSync(join(HIER, 'harness/stumm.html'), wrap(STUB_STUMM));
console.log('harness rebuilt');

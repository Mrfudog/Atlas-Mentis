import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const dir = (d) => readdirSync(d).filter((f) => f.endsWith('.json'));

const page = readFileSync('nebelwacht-artikel.html', 'utf8');
const reg  = Object.fromEntries(dir('dbdump/registry').map((f) =>
  [f.replace(/\.json$/, ''), JSON.parse(readFileSync(`dbdump/registry/${f}`, 'utf8'))]));
const ent  = dir('dbdump/entities').map((f) =>
  JSON.parse(readFileSync(`dbdump/entities/${f}`, 'utf8')));

/* Der echte Speicher liefert eingefrorene Bodies ("Delivered snapshots and
   their data() are frozen"). Der Stub muss das nachbilden — sonst geht jede
   Mutation im Snapshot-Callback hier durch und bricht erst beim Nutzer. */
const STUB_LIVE = `
window.__REG__ = ${JSON.stringify(reg)};
window.__ENT__ = ${JSON.stringify(ent)};
window.__WROTE__ = [];
function tiefKalt(o){
  if(o && typeof o==='object' && !Object.isFrozen(o)){
    Object.freeze(o);
    Object.keys(o).forEach(function(k){ tiefKalt(o[k]); });
  }
  return o;
}
tiefKalt(window.__REG__); tiefKalt(window.__ENT__);
window.claude = { use: async function(n){
  if(n==='user') return { can: async function(){ return true; } };
  if(n!=='db') return null;
  return {
    doc: function(path){ return {
      onSnapshot: function(next){ var part=path.split('/')[1];
        setTimeout(function(){ next(tiefKalt({exists:!!window.__REG__[part],
          data:function(){return window.__REG__[part];}})); },0);
        return function(){}; },
      set: async function(){ window.__WROTE__.push(path); },
      delete: async function(){} }; },
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

const wrap = (stub) =>
  `<!doctype html><html><head><meta charset='utf-8'></head><body>\n<script>${stub}<\/script>\n${page}`;

writeFileSync('harness/index.html', wrap(STUB_LIVE));
writeFileSync('harness/stumm.html', wrap(STUB_STUMM));
console.log('harness rebuilt');

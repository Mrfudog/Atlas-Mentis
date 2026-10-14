import type { Routes } from '@angular/router';
import { wache } from './kern/wache';

/**
 * Die Wache steht vor allem ausser der Anmeldung. Sie ist Bequemlichkeit,
 * keine Sicherheit — die Rechte hängen am Server, und eine Route, die nur
 * hier bewacht wäre, wäre gar nicht bewacht.
 *
 * Die Bereiche sind das Kompendium mit einem Bereich in den Routendaten;
 * welche Art wohin gehört, sagt `area` am Typ.
 */
const kompendium = () => import('./artikel/kompendium').then((m) => m.Kompendium);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.Login),
    title: 'Sign in · Atlas Mentis',
  },
  { path: '', pathMatch: 'full', redirectTo: 'compendium' },
  {
    path: 'compendium',
    canActivate: [wache],
    loadComponent: kompendium,
    title: 'Compendium · Atlas Mentis',
  },
  {
    path: 'world',
    canActivate: [wache],
    loadComponent: kompendium,
    data: { bereich: 'world' },
    title: 'World · Atlas Mentis',
  },
  {
    path: 'story',
    canActivate: [wache],
    loadComponent: kompendium,
    data: { bereich: 'story' },
    title: 'Story · Atlas Mentis',
  },
  /* Hiess bis 13.10. so; ein gespeicherter Link soll nicht ins Leere gehen. */
  { path: 'history', redirectTo: 'story' },
  {
    path: 'rules',
    canActivate: [wache],
    loadComponent: kompendium,
    data: { bereich: 'rules' },
    title: 'Rules · Atlas Mentis',
  },
  /* Boards (REQ-157, 205): die Liste je Geschichtsartikel und ein Board
     als Leinwand. Sie sind kein Bereich — ein Board ist ein Schirm, keine
     Liste von Artikeln (CLAUDE.md, „Play ist ein Schirm"). */
  {
    path: 'boards',
    canActivate: [wache],
    loadComponent: () => import('./boards/boards').then((m) => m.Boards),
    title: 'Boards · Atlas Mentis',
  },
  {
    path: 'boards/:id',
    canActivate: [wache],
    loadComponent: () => import('./boards/board').then((m) => m.Board),
    title: 'Board · Atlas Mentis',
  },
  /* Play › Map (T-115): die Karte der laufenden Sitzung. Ein Schirm,
     kein Bereich — Karte, Initiative und Boards sucht man mitten im Kampf
     nicht in einer Liste (CLAUDE.md, „Play ist ein Schirm"). */
  {
    path: 'play',
    canActivate: [wache],
    loadComponent: () => import('./karten/play').then((m) => m.Play),
    title: 'Play · Atlas Mentis',
  },
  /* Werkbank (W9): Prüfungen und Massenänderungen. Die Wache lässt jeden
     Angemeldeten hinein; was er sieht, entscheidet der Server — die Seite
     sagt nur, wem sie etwas zeigt. */
  {
    path: 'werkbank',
    canActivate: [wache],
    loadComponent: () => import('./werkbank/werkbank').then((m) => m.Werkbank),
    title: 'Workbench · Atlas Mentis',
  },
  /* Das eigene Konto mit seinen API-Tokens. */
  {
    path: 'account',
    canActivate: [wache],
    loadComponent: () => import('./konto/konto').then((m) => m.Konto),
    title: 'Account · Atlas Mentis',
  },
  {
    path: 'classes',
    canActivate: [wache],
    loadComponent: () => import('./klassen/klassen').then((m) => m.Klassen),
    title: 'Classes · Atlas Mentis',
  },
  {
    path: 'classes/:id',
    canActivate: [wache],
    loadComponent: () => import('./klassen/klasse').then((m) => m.Klasse),
    title: 'Class · Atlas Mentis',
  },
  /* Der Assistent für Figuren (T-080): seine Schritte kommen aus den
     Artikeln. Der Stufenaufstieg ist derselbe Assistent an einer Figur. */
  {
    path: 'characters/new',
    canActivate: [wache],
    loadComponent: () => import('./figur/assistent').then((m) => m.Assistent),
    title: 'New character · Atlas Mentis',
  },
  {
    path: 'characters/:id/level-up',
    canActivate: [wache],
    loadComponent: () => import('./figur/assistent').then((m) => m.Assistent),
    title: 'Level up · Atlas Mentis',
  },
  {
    path: 'registry',
    canActivate: [wache],
    loadComponent: () => import('./register/register').then((m) => m.Register),
    title: 'Registry · Atlas Mentis',
  },
  {
    /* Verwaltung (W3): Mitglieder, Rollen, Einladungen. Wer sie sieht,
       sagt der Server; die Wache fragt nur, ob jemand angemeldet ist. */
    path: 'campaign',
    canActivate: [wache],
    loadComponent: () => import('./verwaltung/verwaltung').then((m) => m.Verwaltung),
    title: 'Campaign · Atlas Mentis',
  },
  /* Die Leseansicht (T-091): eine Ebene als Buch; `?at=` oder `?page=`
     springen an die Stelle. */
  {
    path: 'read/:layer',
    canActivate: [wache],
    loadComponent: () => import('./lesen/lesen').then((m) => m.Lesen),
    title: 'Read · Atlas Mentis',
  },
  {
    path: 'artikel/:id/print',
    canActivate: [wache],
    loadComponent: () => import('./artikel/druck').then((m) => m.Druck),
    title: 'Print · Atlas Mentis',
  },
  {
    path: 'artikel/:id',
    canActivate: [wache],
    loadComponent: () => import('./artikel/artikel').then((m) => m.Artikel),
    title: 'Article · Atlas Mentis',
  },
  { path: '**', redirectTo: 'compendium' },
];

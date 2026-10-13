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
    path: 'history',
    canActivate: [wache],
    loadComponent: kompendium,
    data: { bereich: 'history' },
    title: 'History · Atlas Mentis',
  },
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
  {
    path: 'artikel/:id',
    canActivate: [wache],
    loadComponent: () => import('./artikel/artikel').then((m) => m.Artikel),
    title: 'Article · Atlas Mentis',
  },
  { path: '**', redirectTo: 'compendium' },
];

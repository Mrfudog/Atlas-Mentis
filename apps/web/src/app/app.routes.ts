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
  {
    path: 'artikel/:id',
    canActivate: [wache],
    loadComponent: () => import('./artikel/artikel').then((m) => m.Artikel),
    title: 'Article · Atlas Mentis',
  },
  { path: '**', redirectTo: 'compendium' },
];

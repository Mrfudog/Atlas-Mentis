import type { Routes } from '@angular/router';
import { wache } from './kern/wache';

/**
 * Die Wache steht vor allem ausser der Anmeldung. Sie ist Bequemlichkeit,
 * keine Sicherheit — die Rechte hängen am Server, und eine Route, die nur
 * hier bewacht wäre, wäre gar nicht bewacht.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.Login),
    title: 'Sign in · Atlas Mentis',
  },
  {
    path: '',
    canActivate: [wache],
    loadComponent: () => import('./artikel/liste').then((m) => m.Liste),
    title: 'Articles · Atlas Mentis',
  },
  {
    path: 'artikel/:id',
    canActivate: [wache],
    loadComponent: () => import('./artikel/artikel').then((m) => m.Artikel),
    title: 'Article · Atlas Mentis',
  },
  { path: '**', redirectTo: '' },
];

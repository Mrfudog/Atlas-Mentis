import { inject } from '@angular/core';
import { Router, type RedirectFunction, type Routes } from '@angular/router';
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

/** Ein alter Weg auf die Artikelseite (T-191) — mit seinen Abfrageparametern. */
const zumArtikel: RedirectFunction = ({ params, queryParams }) =>
  inject(Router).createUrlTree(['/artikel', params['id']], { queryParams });

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
  /* Play › Maps (T-202): der feste Ort für Karten — Liste mit Vorschau,
     Unterkarten eingerückt, „New map“ aus einem Bild. */
  {
    path: 'maps',
    canActivate: [wache],
    loadComponent: () => import('./karten/karten').then((m) => m.Karten),
    title: 'Maps · Atlas Mentis',
  },
  /* Die Galerie (T-119): alle Bilder, die man sieht — gefiltert nach
     Klasse, Marke, Ebene, „unused". Ein Bild selbst ist ein Artikel. */
  {
    path: 'images',
    canActivate: [wache],
    loadComponent: () => import('./bilder/galerie').then((m) => m.Galerie),
    title: 'Images · Atlas Mentis',
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
  /* Was neu ist (T-157): erreichbar über die Kopfleiste, mit Punkt bei Neuem. */
  {
    path: 'whats-new',
    canActivate: [wache],
    loadComponent: () => import('./neues/neues').then((m) => m.NeuesSeite),
    title: "What's new · Atlas Mentis",
  },
  /* Das Handbuch (T-242, T-225): alle Erklärungen auf einer Seite, mit Glossar. */
  {
    path: 'handbook',
    canActivate: [wache],
    loadComponent: () => import('./handbuch/handbuch').then((m) => m.Handbuch),
    title: 'Handbook · Atlas Mentis',
  },
  {
    path: 'classes',
    canActivate: [wache],
    loadComponent: () => import('./klassen/klassen').then((m) => m.Klassen),
    title: 'Classes · Atlas Mentis',
  },
  /* Eine Klasse, Herkunft, ein Hintergrund zeigen ihre Übersicht als
     Element ihrer Artikelseite (T-191); die alten Wege leiten dorthin,
     `?sub=` und `?opt=` gehen mit. */
  { path: 'classes/:id', redirectTo: zumArtikel },
  /* Herkünfte und Hintergründe wie die Klassen (T-166): eine Liste. */
  {
    path: 'ancestries',
    canActivate: [wache],
    data: { art: 'Ancestry' },
    loadComponent: () => import('./klassen/herkuenfte').then((m) => m.Herkuenfte),
    title: 'Ancestries · Atlas Mentis',
  },
  { path: 'ancestries/:id', redirectTo: zumArtikel },
  {
    path: 'backgrounds',
    canActivate: [wache],
    data: { art: 'Background' },
    loadComponent: () => import('./klassen/herkuenfte').then((m) => m.Herkuenfte),
    title: 'Backgrounds · Atlas Mentis',
  },
  { path: 'backgrounds/:id', redirectTo: zumArtikel },
  /* Der Assistent für Figuren (T-080): seine Schritte kommen aus den
     Artikeln. Der Stufenaufstieg ist derselbe Assistent an einer Figur. */
  {
    path: 'characters/new',
    canActivate: [wache],
    loadComponent: () => import('./figur/assistent').then((m) => m.Assistent),
    title: 'New character · Atlas Mentis',
  },
  /* Kein eigener Level-up mehr (T-319): die Stufen stehen im Assistenten
     je Klasse; eine alte Adresse führt dorthin. */
  { path: 'characters/:id/level-up', redirectTo: 'characters/:id/edit' },
  /* Edit an einer Figur ist der Assistent (T-194); „Full edit" ist die Feldmaske. */
  {
    path: 'characters/:id/edit',
    canActivate: [wache],
    loadComponent: () => import('./figur/assistent').then((m) => m.Assistent),
    data: { mode: 'edit' },
    title: 'Edit character · Atlas Mentis',
  },
  /* Lab › Rules (T-270): der Regel-Builder als Versuch. Die Seite zeigt
     ohne den Schalter `experiments.ruleBuilder` nur einen Hinweis; verlinkt
     ist sie allein aus Rules & options › Experiments. */
  {
    path: 'lab/rules',
    canActivate: [wache],
    loadComponent: () => import('./lab/regel-builder').then((m) => m.RegelBuilder),
    title: 'Rule builder · Atlas Mentis',
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
  /* Die Leseansicht (T-091) ist seit T-191 das Element `reader` auf der
     Seite der Ebene; ein gespeicherter Link landet dort, `?at=` und
     `?page=` springen weiter an die Stelle. */
  {
    path: 'read/:layer',
    redirectTo: ({ params, queryParams }) =>
      inject(Router).createUrlTree(['/artikel', params['layer']], { queryParams: { ...queryParams, tab: 'read' } }),
  },
  /* Fassungen nebeneinander (T-173): links der Artikel, rechts die Fassung. */
  {
    path: 'artikel/:id/compare/:other',
    canActivate: [wache],
    loadComponent: () => import('./artikel/vergleich').then((m) => m.FassungsVergleich),
    title: 'Compare · Atlas Mentis',
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

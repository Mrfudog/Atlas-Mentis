/**
 * Angulars Prüfumgebung einmal aufsetzen.
 *
 * `TestBed` braucht eine initialisierte Umgebung; ohne sie scheitert schon
 * der erste `inject` mit einer Meldung über `ngModule`, die nichts mit dem
 * eigenen Code zu tun hat. Das hier ist die eine Zeile, die das erklärt.
 */
import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

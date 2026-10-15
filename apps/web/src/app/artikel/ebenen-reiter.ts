import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * **Die Reiter einer Ebene** (T-167): „Article" und „Read". Eine Ebene
 * liest man an ihr selbst — der Reiter zeigt dieselbe Leseansicht wie
 * `/read/:layer`, auch vor dem Aufschalten. Ohne Buchtext steht „Read"
 * ausgegraut da und sagt warum, statt zu fehlen.
 */
@Component({
  selector: 'nw-ebenen-reiter',
  imports: [RouterLink],
  template: `
    <nav class="reiter" aria-label="Layer">
      <a [routerLink]="['/artikel', ebene()]" [class.an]="!lesen()" [attr.aria-current]="lesen() ? null : 'page'">Article</a>
      <a [routerLink]="['/artikel', ebene()]" [queryParams]="{ tab: 'read' }" [class.an]="lesen()"
         [class.ohne-text]="ohneText()" [attr.aria-current]="lesen() ? 'page' : null"
         [attr.title]="ohneText() ? 'No text imported yet' : null">Read</a>
      <a class="ganz" [routerLink]="['/read', ebene()]" title="Open the reading view on its own page">Full page ↗</a>
    </nav>
  `,
  styleUrl: './reiter.scss',
})
export class EbenenReiter {
  readonly ebene = input.required<string>();
  readonly lesen = input(false);
  readonly ohneText = input(false);
}

/**
 * **Die Reiter einer Kampagne** (T-190): „Article" und „Rules & options".
 * Die Regeloptionen standen als Felder ungeordnet am Artikel und waren so
 * nicht zu finden; der Reiter zeigt sie nach Sorte, mit dem Regelartikel
 * je Variante. Mit T-132 zeigt derselbe Reiter die gewählten Module.
 */
@Component({
  selector: 'nw-kampagnen-reiter',
  imports: [RouterLink],
  template: `
    <nav class="reiter" aria-label="Campaign">
      <a [routerLink]="['/artikel', kampagne()]" [class.an]="!regeln()" [attr.aria-current]="regeln() ? null : 'page'">Article</a>
      <a [routerLink]="['/artikel', kampagne()]" [queryParams]="{ tab: 'rules' }" [class.an]="regeln()"
         [attr.aria-current]="regeln() ? 'page' : null">Rules &amp; options</a>
    </nav>
  `,
  styleUrl: './reiter.scss',
})
export class KampagnenReiter {
  readonly kampagne = input.required<string>();
  readonly regeln = input(false);
}

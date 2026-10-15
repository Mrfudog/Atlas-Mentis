import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

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

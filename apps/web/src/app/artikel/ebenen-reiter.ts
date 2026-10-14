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
  styles: `
    .reiter {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.25rem;
      border-bottom: 1px solid var(--line);
    }
    a {
      padding: 0.4rem 0.9rem;
      min-height: 36px;
      box-sizing: border-box;
      border: 1px solid transparent;
      border-bottom: 0;
      border-radius: 6px 6px 0 0;
      color: var(--ink);
      text-decoration: none;
    }
    a.an {
      border-color: var(--line);
      background: var(--surface);
      color: var(--accent);
      font-weight: 600;
      margin-bottom: -1px;
    }
    a.ohne-text:not(.an) {
      color: var(--dim);
    }
    a.ganz {
      margin-left: auto;
      font-size: 0.85rem;
      color: var(--link);
    }
  `,
})
export class EbenenReiter {
  readonly ebene = input.required<string>();
  readonly lesen = input(false);
  readonly ohneText = input(false);
}

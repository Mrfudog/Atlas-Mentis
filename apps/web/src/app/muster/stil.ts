import { Directive, computed, inject, input } from '@angular/core';
import { TOKEN_SLOTS } from '@nw/model';
import type { ElementStyle } from '@nw/model';
import { Bestand } from '../kern/bestand';

/**
 * **Das Design eines Elements** (T-425, REQ-437, E-170 a): `[nwStil]` an
 * einer Hülle setzt je Stelle eine Variable `--el-<stelle>` auf das Token
 * (`var(--tok-<name>)`) und eine Klasse `mit-<stelle>`; die Regeln in
 * `styles.scss` färben damit Kopf, Fläche, Rahmen und Text des Inhalts.
 * Eine Stelle ohne Token wird zurückgesetzt, sonst färbte das Design eines
 * Abschnitts jedes Element darin mit.
 *
 * Die Hülle ist `display: contents` und ändert das Layout nicht. Ein
 * Token, das es nicht gibt, gilt nicht.
 */
@Directive({
  selector: '[nwStil]',
  host: {
    class: 'el-hut',
    '[class.mit-head]': 'stellen().head',
    '[class.mit-surface]': 'stellen().surface',
    '[class.mit-frame]': 'stellen().frame',
    '[class.mit-text]': 'stellen().text',
    '[style]': 'vars()',
  },
})
export class Stil {
  readonly nwStil = input<ElementStyle | undefined>(undefined);
  private readonly bestand = inject(Bestand);

  protected readonly stellen = computed(() => {
    const t = this.bestand.registry()?.tokens ?? {};
    const s = this.nwStil() ?? {};
    return Object.fromEntries(TOKEN_SLOTS.map((k) => [k, s[k] && t[s[k]!] ? s[k] : undefined])) as ElementStyle;
  });

  protected readonly vars = computed(() => {
    const s = this.stellen();
    return Object.fromEntries(TOKEN_SLOTS.map((k) => [`--el-${k}`, s[k] ? `var(--tok-${s[k]})` : 'initial']));
  });
}

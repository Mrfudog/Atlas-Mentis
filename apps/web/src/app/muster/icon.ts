import { Component, computed, input } from '@angular/core';
import { iconDef } from '@nw/model';

/**
 * **Ein Icon** (T-461, REQ-460): ein Name aus dem Katalog (`@nw/model`,
 * `ICONS`), gezeichnet als Inline-SVG in Schriftgrösse und Textfarbe —
 * im Titel gross, in der Listenzeile klein, hell und dunkel im Kontrast
 * der Schrift. Was der Katalog nicht kennt, zeichnet nichts und nimmt
 * keinen Platz: ein leeres Kästchen sähe aus wie ein Fehler im Icon.
 *
 * **Barrierearm** (REQ-460): steht der Name daneben, ist das Icon Zierde
 * (`aria-hidden`); steht er nicht daneben, sagt `label`, was es zeigt —
 * dann ist es ein Bild mit Namen. Wer ein Icon ohne Text zeichnet, gibt
 * `label` an; der Test prüft beides.
 */
@Component({
  selector: 'nw-icon',
  template: `
    @if (def(); as d) {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
        <path [attr.d]="d.d" />
      </svg>
    }
  `,
  styles: `
    :host { display: inline-block; width: 1em; height: 1em; vertical-align: -0.15em; flex: none; }
    :host(.leer) { display: none; }
    svg { display: block; width: 100%; height: 100%; }
  `,
  host: {
    class: 'nw-icon',
    '[class.leer]': '!def()',
    '[attr.data-icon]': 'def()?.id ?? null',
    '[attr.role]': 'label() && def() ? "img" : null',
    '[attr.aria-label]': 'label() && def() ? label() : null',
    '[attr.aria-hidden]': 'label() && def() ? null : "true"',
    '[attr.title]': 'label() && def() ? label() : null',
  },
})
export class Icon {
  /** Der Name im Katalog; leer oder unbekannt zeichnet nichts. */
  readonly name = input<string | undefined | null>(undefined);
  /** Die Text-Alternative — nur, wo der Name nicht daneben steht. */
  readonly label = input<string>('');
  protected readonly def = computed(() => iconDef(this.name()));
}

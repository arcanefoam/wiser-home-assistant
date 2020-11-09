import { CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';
import { Toast } from './styles/toast';
import { Wiser } from './styles/wiser';
import { icon } from './icons';
import './timer';

const capitalize = (s): string => {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Returns the CSS class to use for the given setpoint
 * @param setpoint
 */
function comfort(setpoint: string): string {
  const sp = Number(setpoint);
  if (sp == NaN) {
    return 'off';
  }
  if (sp > 25) {
    return 'too_hot';
  } else if (sp > 21) {
    return 'warm';
  } else if (sp > 17) {
    return 'comfortable';
  } else if (sp > 15) {
    return 'cool';
  } else if (sp > 10) {
    return 'cold';
  }
  return 'off';
}

@customElement('wiser-room-digest')
export class RoomDigest extends LitElement {
  @property() public name = 'Room';
  @property() public temperature = '20';
  @property() public setpoint = '20';
  @property({ type: Boolean }) public heating = false;
  @property({ type: Boolean }) public manual = false;
  @property() public boost = 0;
  @property() public boost_ticks = 0;

  protected render(): TemplateResult | void {
    return html`
      <div class="room">
        <div class="name">
          ${capitalize(this.name)}
        </div>
        <div class="container">
          <div class="grid">
            ${this.setpoint === 'OFF'
              ? html`
                  <div class="grid__col grid__col--2-of-12 setpoint ${comfort(this.setpoint)}">
                    ${this.setpoint} °
                  </div>
                  <div class="grid__col grid__col--push-1-of-12 grid__col--2-of-12 heating svg-icon">
                    ${this.heating ? icon('Heating', 40) : ''}
                  </div>
                `
              : html`
                  <div class="grid__col grid__col--3-of-12 setpoint ${comfort(this.setpoint)}">
                    ${this.setpoint} °
                  </div>
                  <div class="grid__col grid__col--2-of-12 heating svg-icon">
                    ${this.heating ? icon('Heating', 40) : ''}
                  </div>
                `}
            <div class="grid__col grid__col--2-of-12 manual svg-icon">
              ${this.manual ? icon('Manual', 40) : ''}
            </div>
            ${this.boost != 0
              ? html`
                  <div class="grid__col grid__col--2-of-12 align-center">
                    <wiser-boost-timer direction="${this.boost}" boost_ticks="${this.boost_ticks}"></wiser-boost-timer>
                  </div>
                `
              : html`
                  <div class="grid__col grid__col--2-of-12"></div>
                `}
            <div class="grid__col grid__col--3-of-12 current align-right">${this.temperature} °</div>
          </div>
        </div>
      </div>
    `;
  }

  static get styles(): CSSResult[] {
    return [new Toast().styles(), new Wiser().styles()];
  }
}

import { CSSResult, customElement, html, LitElement, property } from 'lit-element';
import { Toast } from './styles/toast';
import { Wiser } from './styles/wiser';

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

const boostClass = {
  '+': 'boostup',
  '-': 'boostdown',
};

@customElement('wiser-room-digest')
export class RoomDigest extends LitElement {
  @property() public name = 'Room';
  @property() public temperature = '20';
  @property() public setpoint = '20';
  @property({ type: Boolean }) public heating = false;
  @property({ type: Boolean }) public manual = false;
  @property() public boost = 0;

  render() {
    console.log('room heating', this.heating);
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
                  <div class="grid__col grid__col--push-2-of-12 grid__col--1-of-12">
                    ${this.heating
                      ? html`
                          <ha-icon class="icon" style="color: #ff9900;" icon="hass:fire"></ha-icon>
                        `
                      : html`
                          <ha-icon></ha-icon>
                        `}
                  </div>
                `
              : html`
                  <div class="grid__col grid__col--4-of-12 setpoint ${comfort(this.setpoint)}">
                    ${this.setpoint} °
                  </div>
                  <div class="grid__col grid__col--1-of-12">
                    ${this.heating
                      ? html`
                          <ha-icon class="icon" style="color: #ff9900;" icon="hass:fire"></ha-icon>
                        `
                      : html`
                          <ha-icon></ha-icon>
                        `}
                  </div>
                `}
            <div class="grid__col grid__col--1-of-12">
              ${this.manual
                ? html`
                    <ha-icon class="icon" style="color: #efe91e;" icon="hass:hand-right"></ha-icon>
                  `
                : html`
                    <ha-icon></ha-icon>
                  `}
            </div>
            ${this.boost != 0
              ? html`
                  <div class="grid__col grid__col--2-of-12 align-center ${boostClass[this.boost]}">${this.boost}</div>
                `
              : html`
                  <div class="grid__col grid__col--2-of-12"></div>
                `}
            <div class="grid__col grid__col--4-of-12 current align-right">${this.temperature} °</div>
          </div>
        </div>
      </div>
    `;
  }

  static get styles(): CSSResult[] {
    return [new Toast().styles(), new Wiser().styles()];
  }
}

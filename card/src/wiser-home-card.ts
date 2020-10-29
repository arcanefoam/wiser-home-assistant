import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers';

import './editor';

import { WiserHomeCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';

import { localize } from './localize/localize';
import { Toast } from './styles/toast';
import './room';
import { Header } from './styles/header';

/* eslint no-console: 0 */
console.info(
  `%c  WISER-HOME-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

const homeIcons = {
  'heat-demand': 'mdi:fire',
};

const debug = true;

const modeIcon = {
  Auto: {
    svg: html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        version="1.1"
        id="mdi-calendar-clock"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          d="M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z"
        />
      </svg>
    `,
    alt: 'Auto',
  },
  Manual: {
    svg: html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        version="1.1"
        id="manual-mode"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          id="path3411"
          d="M 3.1816406 1 C 1.9782966 1 1.0097656 1.9685305 1.0097656 3.171875 L 1.0097656 18.828125 C 1.0097656 20.031469 1.9782966 21 3.1816406 21 L 10 21 L 10 18.777344 L 3.2324219 18.777344 L 3.2324219 3.2226562 L 18.787109 3.2226562 L 18.787109 10 L 21.009766 10 L 21.009766 3.171875 C 21.009766 1.9685305 20.041236 1 18.837891 1 L 3.1816406 1 z M 3.9667969 4.7597656 L 3.9667969 7.0019531 L 7.2949219 7.0019531 L 7.2949219 4.7597656 L 3.9667969 4.7597656 z M 8.40625 4.7597656 L 8.40625 7.0019531 L 11.734375 7.0019531 L 11.734375 4.7597656 L 8.40625 4.7597656 z M 12.84375 4.7597656 L 12.84375 7.0019531 L 16.171875 7.0019531 L 16.171875 4.7597656 L 12.84375 4.7597656 z M 3.9667969 8.0976562 L 3.9667969 10.339844 L 7.2949219 10.339844 L 7.2949219 8.0976562 L 3.9667969 8.0976562 z M 8.40625 8.0976562 L 8.40625 10.339844 L 11.734375 10.339844 L 11.734375 8.0976562 L 8.40625 8.0976562 z M 16.679688 10.90625 A 0.68193749 0.68193749 0 0 0 15.998047 11.587891 L 15.998047 15.908203 L 15.544922 15.908203 L 15.544922 12.722656 A 0.68193749 0.68193749 0 0 0 14.863281 12.041016 A 0.68193749 0.68193749 0 0 0 14.179688 12.722656 L 14.179688 18.140625 C 14.179687 18.140625 12.239026 17.026984 12.222656 17.021484 C 12.140824 16.972384 12.047419 16.945312 11.949219 16.945312 C 11.812831 16.945312 11.688044 16.994741 11.589844 17.082031 C 11.573477 17.087486 11 17.648438 11 17.648438 L 14.568359 21.271484 C 14.9066 21.620636 15.370333 21.816406 15.861328 21.816406 L 19.183594 21.816406 A 1.8166815 1.8166815 0 0 0 21 20 L 21 13.404297 A 0.68193749 0.68193749 0 0 0 20.318359 12.722656 A 0.68193749 0.68193749 0 0 0 19.636719 13.404297 L 19.636719 15.908203 L 19.183594 15.908203 L 19.183594 12.041016 A 0.68193749 0.68193749 0 0 0 18.501953 11.359375 C 18.120068 11.359375 17.820312 11.664587 17.820312 12.041016 L 17.820312 15.908203 L 17.361328 15.908203 L 17.361328 11.587891 C 17.361328 11.211461 17.061573 10.90625 16.679688 10.90625 z M 3.9667969 11.435547 L 3.9667969 13.675781 L 7.2949219 13.675781 L 7.2949219 11.435547 L 3.9667969 11.435547 z M 8.40625 11.435547 L 8.40625 13.675781 L 11.734375 13.675781 L 11.734375 11.435547 L 8.40625 11.435547 z "
        />
      </svg>
    `,
    alt: 'Manual',
  },
  Away: {
    svg: html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        version="1.1"
        id="mdi-walk"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          d="M14.12,10H19V8.2H15.38L13.38,4.87C13.08,4.37 12.54,4.03 11.92,4.03C11.74,4.03 11.58,4.06 11.42,4.11L6,5.8V11H7.8V7.33L9.91,6.67L6,22H7.8L10.67,13.89L13,17V22H14.8V15.59L12.31,11.05L13.04,8.18M14,3.8C15,3.8 15.8,3 15.8,2C15.8,1 15,0.2 14,0.2C13,0.2 12.2,1 12.2,2C12.2,3 13,3.8 14,3.8Z"
        />
      </svg>
    `,
    alt: 'Away',
  },
};

@customElement('wiser-home-card')
export class WiserHomeCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('wiser-home-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {};
  }

  // TODO Add any properties that should cause your element to re-render here
  @property() public hass?: HomeAssistant;
  @property() private config?: WiserHomeCardConfig;

  public setConfig(config: WiserHomeCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config || config.show_error) {
      throw new Error(localize('common.invalid_configuration'));
    }
    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this.config = {
      ...config,
    };
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  protected render(): TemplateResult | void {
    if (!this.config || !this.hass) {
      return html``;
    }

    // TODO Check for stateObj or other necessary things and render a warning if missing
    if (this.config.show_warning) {
      return html`
        <ha-card>
          <div class="warning">${localize('common.show_warning')}</div>
        </ha-card>
      `;
    }

    const stateObj = this.hass.states[this.config.entity!];
    if (!stateObj) {
      return html`
        <hui-warning
          >${this.hass.localize(
            'ui.panel.lovelace.warning.entity_not_found',
            'entity',
            this.config.entity,
          )}</hui-warning
        >
      `;
    }
    const rooms = stateObj.attributes.rooms;
    let room = {
      heating: false,
      manual: true,
      name: 'kitchen',
      setpoint: '16',
      temperature: 20,
      valve_boost: '+',
    };
    rooms.push(room);
    room = {
      heating: true,
      manual: false,
      name: 'office',
      setpoint: '26.5',
      temperature: 28.6,
      valve_boost: '-',
    };
    rooms.push(room);
    return html`
      <ha-card
        @action=${this._handleAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this.config.hold_action),
          hasDoubleClick: hasAction(this.config.double_tap_action),
        })}
        tabindex="0"
        aria-label=${`Wiser-Home: ${this.config.entity}`}
      >
        <div class="header">
          <div class="container">
            <div class="grid">
              <div class="grid__col grid__col--1-of-6">
                <img src="/local/img/wiserheat.png" style="width: 32px" />
              </div>
              <div class="grid__col grid__col--1-of-6 align-center">
                ${this.config && this.config.name}
              </div>
              <div class="grid__col grid__col--1-of-6 svg-icon">
                ${modeIcon[stateObj.state].svg}
                <div class="fallback">${modeIcon[stateObj.state].alt}</div>
              </div>
              <div class="grid__col grid__col--1-of-6">
                ${stateObj.attributes.boiler == 'On'
                  ? html`
                      <ha-icon style="width: 30px; height: 30px; color: #ff3300;" icon="hass:water-boiler"></ha-icon>
                    `
                  : html`
                      <ha-icon style="width: 30px; height: 30px; color: #6b6b6b;" icon="hass:water-boiler"></ha-icon>
                    `}
              </div>
              <div class="grid__col grid__col--2-of-6">
                Boost <mwc-switch @click=${this.boostHandler()} style="position: relative;"></mwc-switch>
              </div>
            </div>
          </div>
        </div>
        ${rooms
          ? html`
              <div class="card-content test">
                ${rooms.map(item => {
                  console.log('room', item);
                  return html`
                    <wiser-room-digest
                      name="${item.name}"
                      temperature="${item.temperature}"
                      setpoint="${item.setpoint}"
                      ?heating="${item.heating}"
                      ?manual="${item.manual}"
                      boost="${item.valve_boost}"
                    ></wiser-room-digest>
                  `;
                })}
              </div>
            `
          : ''}
      </ha-card>
    `;
  }

  private _handleAction(ev: ActionHandlerEvent): void {
    if (this.hass && this.config && ev.detail.action) {
      handleAction(this, this.hass, this.config, ev.detail.action);
    }
  }

  static get styles(): CSSResult[] {
    return [
      new Toast().styles(),
      new Header().styles(),
      css`
        .header {
          font-family: var(--paper-font-headline_-_font-family);
          -webkit-font-smoothing: var(--paper-font-headline_-_-webkit-font-smoothing);
          font-size: var(--paper-font-headline_-_font-size);
          font-weight: var(--paper-font-headline_-_font-weight);
          letter-spacing: var(--paper-font-headline_-_letter-spacing);
          line-height: var(--paper-font-headline_-_line-height);
          text-rendering: var(--paper-font-common-expensive-kerning_-_text-rendering);
          opacity: var(--dark-primary-opacity);
          padding: 24px 16px 16px;
          display: flex;
          align-items: baseline;
        }
      `,
    ];
  }

  private boostHandler() {
    console.log('Boost handlers');
  }
}

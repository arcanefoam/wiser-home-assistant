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

const modeIcon = {
  Auto: 'mdi-calendar-clock',
  Manual: 'mdi-account-box',
  Away: 'mdi-home-export-outline',
};

const boostClass = {
  '+': 'boostup',
  '-': 'boostdown',
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
            <div class="column">
              <img src="/local/img/wiserheat.png" style="width: 32px" />
            </div>
            <div class="column">
              ${this.config && this.config.name}
            </div>
            <div class="column">
              ${stateObj.state}
            </div>
            <div class="column">
              ${stateObj.attributes.boiler == 'On'
                ? html`
                    <ha-icon style="width: 30px; height: 30px; color: #ff3300;" icon="hass:power"></ha-icon>
                  `
                : html`
                    <ha-icon style="width: 30px; height: 30px; color: #6b6b6b;" icon="hass:power"></ha-icon>
                  `}
            </div>
            <div class="column">
              Boost <mwc-switch @click=${this.boostHandler()} style="position: relative;"></mwc-switch>
            </div>
          </div>
        </div>
        ${rooms
          ? html`
              <div class="card-content test">
                ${rooms.map(
                  item => html`
                    <div class="room">
                      <div class="name">
                        ${capitalize(item.name)}
                      </div>
                      <div class="container data">
                        <div class="column setpoint align-right ${comfort(item.setpoint)}">
                          ${item.setpoint} °
                        </div>
                        <div class="column"></div>
                        <div class="column align-right">
                          ${item.heating
                            ? html`
                                <ha-icon style="width: 30px; height: 30px; color: #ff9900;" icon="hass:fire"></ha-icon>
                              `
                            : html`
                                <ha-icon></ha-icon>
                              `}
                        </div>
                        ${item.valve_boost != 0
                          ? html`
                              <div class="column ${boostClass[item.valve_boost]}">${item.valve_boost}</div>
                            `
                          : html`
                              <div class="column"></div>
                            `}
                        <div class="column current align-left">${item.temperature} °</div>
                      </div>
                    </div>
                  `,
                )}
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

  static get styles(): CSSResult {
    return css`
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
      .name {
        margin-left: 16px;
        font-size: 16px;
        color: DimGray;
      }
      .container {
        display: flex;
      }
      .column {
        float: left;
        position: relative;
        width: 20%;
      }
      .data {
        padding: 5px;
      }
      .current {
        font-weight: 300;
        font-size: 30px;
        padding-right: 15px;
      }
      .room {
        padding: 5px;
        margin-top: 5px;
        background-color: #e8e8e8;
        border-radius: 15px 15px 15px 15px;
        width: auto;
        height: auto;
      }
      .too_hot {
        background-color: #cc0000;
        color: white;
      }
      .warm {
        background-color: #ff6600;
        color: white;
      }
      .comfortable {
        background-color: #009933;
        color: white;
      }
      .cool {
        background-color: #00cc00;
        color: white;
      }
      .cold {
        background-color: #00ccff;
        color: white;
      }
      .off {
        background-color: WhiteSmoke;
        color: black;
      }
      .setpoint {
        border-radius: 0px 10px 10px 0px;
        width: 80px;
        height: 20px;
        line-height: 20px;
        padding: 5px 10px 5px 30px;
        display: inline-block;
        vertical-align: middle;
      }
      .boostup {
        color: #0000ff;
        font-size: 20px;
      }
      .boostdown {
        color: #ff0000;
        font-size: 20px;
      }
      .align-right {
        text-align: right;
      }
      .align-left {
        text-align: left;
      }
      .align-center {
        text-align: left;
      }
      .superscript {
        font-size: 17px;
        font-weight: 600;
        position: absolute;
        right: -5px;
        top: 15px;
      }
      .warning {
        display: block;
        color: black;
        background-color: #fce588;
        padding: 8px;
      }
    `;
  }

  private boostHandler() {
    console.log('Boost handlers');
  }
}

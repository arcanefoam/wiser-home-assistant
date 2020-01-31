import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
  computeStateName,
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

const capitalize = (s): string => {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function comfort(current_setpoint: string): string {
  const setpoint = Number(current_setpoint);
  if (setpoint == NaN) {
    return 'off';
  }
  if (setpoint > 25) {
    return 'too_hot';
  } else if (setpoint > 21) {
    return 'warm';
  } else if (setpoint > 17) {
    return 'comfortable';
  } else if (setpoint > 15) {
    return 'cool';
  }
  return 'cool';
}

// TODO Name your custom element
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
  @property() private _config?: WiserHomeCardConfig;

  public setConfig(config: WiserHomeCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config || config.show_error) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._config = {
      ...config,
    };
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    // TODO Check for stateObj or other necessary things and render a warning if missing
    if (this._config.show_warning) {
      return html`
        <ha-card>
          <div class="warning">${localize('common.show_warning')}</div>
        </ha-card>
      `;
    }

    const stateObj = this.hass.states[this._config.entity!];
    if (!stateObj) {
      return html`
        <hui-warning
          >${this.hass.localize(
            'ui.panel.lovelace.warning.entity_not_found',
            'entity',
            this._config.entity,
          )}</hui-warning
        >
      `;
    }
    const rooms = stateObj.attributes.rooms;
    return html`
      <ha-card
        @action=${this._handleAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this._config.hold_action),
          hasDoubleTap: hasAction(this._config.double_tap_action),
          repeat: this._config.hold_action ? this._config.hold_action.repeat : undefined,
        })}
        tabindex="0"
        aria-label=${`Wiser-Home: ${this._config.entity}`}
      >
        <div class="header">
          ${stateObj.state}
          <div class="name">
            ${(this._config && this._config.name) || computeStateName(stateObj)}
          </div>
        </div>
        ${rooms
          ? html`
              <div class="card-content">
                ${rooms.map(
                  item => html`
                    <div class="room">
                      <div class="name">
                        ${capitalize(item.name)}
                      </div>
                      <div class="container data">
                        <div class="column setpoint align-right ${comfort(item.current_setpoint)}">
                          ${item.current_setpoint} °
                        </div>
                        <div class="column"></div>
                        <div class="column align-right">
                          ${!item.heating
                            ? html`
                                <ha-icon style="width: 30px; height: 30px; color: #ff9900;" icon="hass:fire"></ha-icon>
                              `
                            : html`
                                <ha-icon></ha-icon>
                              `}
                        </div>
                        <div class="column"></div>
                        <div class="column current align-left">${item.current_temp} °</div>
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
    if (this.hass && this._config && ev.detail.action) {
      handleAction(this, this.hass, this._config, ev.detail.action);
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
        color: var(--secondary-text-color);
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
        padding: 10px;
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
      }
      .warm {
        background-color: #ff6600;
      }
      .comfortable {
        background-color: #009933;
      }
      .cool {
        background-color: #00cc00;
      }
      .cold {
        background-color: #00ccff;
      }
      .off {
        background-color: WhiteSmoke;
      }
      .setpoint {
        border-radius: 0px 15px 15px 0px;
        width: auto;
        height: auto;
        line-height: 30px;
        padding: 5px 10px 5px 30px;
        display: inline-block;
        vertical-align: middle;
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
}

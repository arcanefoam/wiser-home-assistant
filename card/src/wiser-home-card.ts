import { LitElement, CSSResult, PropertyValues, TemplateResult, customElement, property, css, html } from 'lit-element';
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
import { icon } from './icons';
import dayjs, { Dayjs } from 'dayjs';

/* eslint no-console: 0 */
console.info(
  `%c  WISER-HOME-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

const debug = false;

@customElement('wiser-home-card')
export class WiserHomeCard extends LitElement {
  constructor(private ticks1: Dayjs, private ticks2: Dayjs) {
    super();
    const now = dayjs();
    this.ticks1 = now.add(1, 'h');
    this.ticks2 = now.add(30, 'm');
  }

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

    const stateObj = this.config.entity != null ? this.hass.states[this.config.entity] : null;
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

    if (debug) {
      const now = dayjs();
      //this.ticks1 = new Date(now.getTime() + 60 * 60000);
      if (this.ticks1.isBefore(now)) {
        this.ticks1 = now.add(1, 'h');
      }
      if (this.ticks2.isBefore(now)) {
        this.ticks2 = now.add(30, 'm');
      }
      let room = {
        heating: false,
        manual: true,
        name: 'caliente',
        setpoint: '16',
        temperature: 20,
        valve_boost: '+',
        boost_end: this.ticks1,
      };
      rooms.push(room);
      room = {
        heating: true,
        manual: false,
        name: 'frio',
        setpoint: '26.5',
        temperature: 28.6,
        valve_boost: '-',
        boost_end: this.ticks2,
      };
      rooms.push(room);
      room = {
        heating: true,
        manual: true,
        name: 'manual',
        setpoint: '22',
        temperature: 15.8,
        valve_boost: '0',
        boost_end: now,
      };
      rooms.push(room);
      stateObj.attributes.boiler = 'On';
    }

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
                <img class="wiserheat" src="/local/img/wiserheat.png" />
              </div>
              <div class="grid__col grid__col--1-of-6 align-center">
                ${this.config && this.config.name}
              </div>
              <div class="grid__col grid__col--1-of-6 svg-icon">
                ${icon(stateObj.state, 24)}
              </div>
              <div class="grid__col grid__col--1-of-6">
                ${stateObj.attributes.boiler == 'On'
                  ? html`
                      <ha-icon style="width: 30px; height: 30px;" icon="hass:radiator"></ha-icon>
                    `
                  : html`
                      <ha-icon style="width: 30px; height: 30px;" icon="hass:radiator-disabled"></ha-icon>
                    `}
              </div>
              <div class="grid__col grid__col--2-of-6 boost">
                Boost <mwc-switch @click=${this.boostHandler()} style="position: relative;"></mwc-switch>
              </div>
            </div>
          </div>
        </div>
        ${rooms
          ? html`
              <div class="card-content test">
                ${rooms.map(item => {
                  return html`
                    <wiser-room-digest
                      name="${item.name}"
                      temperature="${item.temperature}"
                      setpoint="${item.setpoint}"
                      ?heating="${item.heating}"
                      ?manual="${item.manual}"
                      boost="${item.valve_boost}"
                      boost_end="${item.boost_end}"
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

  private boostHandler(): void {
    console.log('Boost handlers');
  }
}

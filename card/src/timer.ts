import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';
import dayjs, { Dayjs } from 'dayjs';

const boostClass = {
  '+': {
    cls: 'boostup',
    elapsed: '#6f6f6f',
    path:
      'm 13.351547,16.779689 0,2.285428 3.42814,0 0,3.428139 2.285428,0 0,-3.428139 3.428141,0 0,-2.285428 -3.428141,0 0,-3.428141 -2.285428,0 0,3.428141 M 5.6035156,9.9980469 A 1.6,1.6 0 0 0 4.0039062,11.597656 l 0,6.400391 1.5996094,0 0,-1.601563 6.4960934,0 a 6.0275984,6.0275984 0 0 1 0.873047,-1.910156 0.8,0.8 0 0 1 -0.167968,-0.488281 l 0,-1.601563 a 0.8,0.8 0 0 1 0.798828,-0.798828 0.8,0.8 0 0 1 0.800781,0.798828 l 0,0.640625 a 6.0275984,6.0275984 0 0 1 1.623047,-0.828125 0.8,0.8 0 0 1 0.777344,-0.611328 0.8,0.8 0 0 1 0.636718,0.31836 6.0275984,6.0275984 0 0 1 0.480469,-0.02149 6.0275984,6.0275984 0 0 1 2.082031,0.378907 l 0,-0.675782 A 1.6,1.6 0 0 0 18.404297,9.9980469 l -12.8007814,0 z M 7.203125,11.597656 a 0.8,0.8 0 0 1 0.8007812,0.798828 l 0,1.601563 A 0.8,0.8 0 0 1 7.203125,14.796875 0.8,0.8 0 0 1 6.4042969,13.998047 l 0,-1.601563 A 0.8,0.8 0 0 1 7.203125,11.597656 Z m 3.201172,0 a 0.8,0.8 0 0 1 0.798828,0.798828 l 0,1.601563 a 0.8,0.8 0 0 1 -0.798828,0.798828 0.8,0.8 0 0 1 -0.8007814,-0.798828 l 0,-1.601563 A 0.8,0.8 0 0 1 10.404297,11.597656 Z M 8.7599997,2.7735629 7.624,4.5255627 l 1.1359997,1.768 -0.008,0 L 7.16,8.7735628 5.7760002,8.0535628 6.912,6.2855627 5.7760002,4.5255627 7.376,2.0455629 l 1.3839997,0.728 m 4.8000013,-0.088 -1.136,1.7679998 1.136,1.76 -0.008,0.008 -1.592,2.4720001 -1.384001,-0.72 1.136001,-1.7600001 -1.136001,-1.76 1.600001,-2.4799998 1.384,0.712 m 4.84,0 -1.152,1.7679998 1.152,1.76 0,0.008 -1.6,2.4720001 -1.4,-0.72 1.136,-1.7600001 -1.136,-1.76 1.6,-2.4799998 1.4,0.712',
    fill: '#6f6f6f',
  },
  '-': {
    cls: 'boostdown',
    elapsed: '#6f6f6f',
    path:
      'm 13.351547,16.779689 0,2.285428 c 3.288165,0 5.870232,0 9.141709,0 l 0,-2.285428 M 5.6035156,9.9980469 C 4.7201652,9.9982625 4.004122,10.714306 4.0039062,11.597656 l 0,6.400391 1.5996094,0 0,-1.601563 6.4960934,0 c 0.176992,-0.682903 0.472492,-1.329434 0.873047,-1.910156 -0.108421,-0.13972 -0.167489,-0.311429 -0.167968,-0.488281 l 0,-1.601563 c 6.45e-4,-0.440913 0.357915,-0.798183 0.798828,-0.798828 0.441675,-4.32e-4 0.800134,0.357153 0.800781,0.798828 l 0,0.640625 c 0.495926,-0.356692 1.043193,-0.635924 1.623047,-0.828125 0.08705,-0.358706 0.408225,-0.611287 0.777344,-0.611328 0.250363,6.42e-4 0.485987,0.118454 0.636718,0.31836 0.159807,-0.01355 0.320091,-0.02072 0.480469,-0.02149 0.710925,0.0025 1.415797,0.13081 2.082031,0.378907 l 0,-0.675782 C 20.003687,10.714303 19.287645,9.9982627 18.404297,9.9980469 Z M 7.203125,11.597656 c 0.4416755,-4.32e-4 0.8001344,0.357153 0.8007812,0.798828 l 0,1.601563 C 8.0032594,14.439722 7.6448005,14.797307 7.203125,14.796875 6.7622121,14.79623 6.4049424,14.43896 6.4042969,13.998047 l 0,-1.601563 c 6.455e-4,-0.440913 0.3579152,-0.798183 0.7988281,-0.798828 z m 3.201172,0 c 0.440913,6.45e-4 0.798183,0.357915 0.798828,0.798828 l 0,1.601563 C 11.20248,14.43896 10.84521,14.79623 10.404297,14.796875 9.9626215,14.797307 9.6041624,14.439722 9.6035156,13.998047 l 0,-1.601563 c 6.468e-4,-0.441675 0.3591059,-0.79926 0.8007814,-0.798828 z M 8.7599997,2.7735629 7.624,4.5255627 l 1.1359997,1.768 -0.008,0 L 7.16,8.7735628 5.7760002,8.0535628 6.912,6.2855627 5.7760002,4.5255627 7.376,2.0455629 l 1.3839997,0.728 m 4.8000013,-0.088 -1.136,1.7679998 1.136,1.76 -0.008,0.008 -1.592,2.4720001 -1.384001,-0.72 1.136001,-1.7600001 -1.136001,-1.76 1.600001,-2.4799998 1.384,0.712 m 4.84,0 -1.152,1.7679998 1.152,1.76 0,0.008 -1.6,2.4720001 -1.4,-0.72 1.136,-1.7600001 -1.136,-1.76 1.6,-2.4799998 1.4,0.712',
    fill: '#6f6f6f',
  },
};

const FULL_DASH_ARRAY = 283;

@customElement('wiser-boost-timer')
export class BoostTimer extends LitElement {
  @property() public direction = '';
  @property({
    converter: value => {
      if (value !== null) {
        return dayjs(value);
      }
      return undefined;
    },
  })
  public boost_end: Dayjs | null = null;

  // Update the dasharray value as time passes, starting with FULL_DASH_ARRAY (283) function
  circleDasharray(): string {
    if (this.boost_end == null) {
      return `0 ${FULL_DASH_ARRAY}`;
    }
    const now = dayjs();
    let diff = this.boost_end.diff(now, 'm');
    if (diff < 0) {
      diff = 0;
    }
    return `${((diff / 60) * FULL_DASH_ARRAY).toFixed(0)} ${FULL_DASH_ARRAY}`;
  }

  protected render(): TemplateResult | void {
    console.log('BoostTimer');
    return html`
      <div class="base-timer">
        <svg class="base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <g class="base-timer__circle">
            <circle
              class="base-timer__path-elapsed"
              cx="50"
              cy="50"
              r="45"
              stroke="${boostClass[this.direction]['elapsed']}"
            />
            <path
              id="base-timer-path-remaining"
              stroke-dasharray="${this.circleDasharray()}"
              class="base-timer__path-remaining ${boostClass[this.direction]['cls']}"
              d="M 50, 50 m -45, 0 a 45,45 0 1,0 90,0 a 45,45 0 1,0 -90,0"
            ></path>
          </g>
        </svg>
        <svg
          class="base-timer__label"
          viewBox="0 0 34 34"
          fill=" ${boostClass[this.direction]['fill']}"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path id="base-timer-label" d="${boostClass[this.direction]['path']}"></path>
        </svg>
      </div>
    `;
  }

  static get styles(): CSSResult {
    return css`
      .boostup {
        color: #dc3545;
      }
      .boostdown {
        color: #17a2b8;
      }
      .base-timer svg {
        position: relative;
      }
      /* Sets the containers height and width */
      .base-timer {
        position: relative;
        height: 40px;
        width: 40px;
      }
      /* Removes SVG styling that would hide the time label */
      .base-timer__circle {
        fill: none;
        stroke: none;
      }
      .base-timer__label {
        top: -40px;
        left: 4px;
        transform: perspective(1px) translateY(-25%);
      }
      /* The SVG path that displays the timer's progress */
      .base-timer__path-elapsed {
        stroke-width: 10px;
      }
      .base-timer__path-remaining {
        /* Just as thick as the original ring */
        stroke-width: 10px;

        /* Rounds the line endings to create a seamless circle */
        stroke-linecap: round;

        /* Makes sure the animation starts at the top of the circle */
        transform: rotate(90deg);
        transform-origin: center;

        /* 60 seconds aligns with the speed of the countdown*/
        transition: 60s linear all;

        /* Allows the ring to change color when the color value updates */
        stroke: currentColor;
      }
      .base-timer__svg {
        /* Flips the svg and makes the animation to move left-to-right */
        transform: scaleX(-1);
        top: 0%;
        -webkit-transform: perspective(1px) translateY(-25%);
        -ms-transform: perspective(1px) translateY(-25%);
        transform: perspective(1px) translateY(-25%);
      }
    `;
  }
}

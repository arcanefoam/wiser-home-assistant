import { Style } from './styles';
import { css, CSSResult } from 'lit-element';

export class Header implements Style {
  styles(): CSSResult {
    return css`
      .align-center {
        text-align: center;
      }
      .warning {
        display: block;
        color: black;
        background-color: #fce588;
        padding: 8px;
      }
      .icon {
        --mdc-icon-size: 40px;
        height: 40px;
        width: 40px;
      }
      .svg-icon svg {
        position: relative;
        top: 0%;
        -webkit-transform: perspective(1px) translateY(20%);
        -ms-transform: perspective(1px) translateY(20%);
        transform: perspective(1px) translateY(20%);
        fill: var(--primary-text-color);
      }
      .fallback {
        display: none;
      }
      .no-svg .fallback {
      }
    `;
  }
}

import { Style } from './styles';
import { css, CSSResult } from 'lit-element';

export class Wiser implements Style {
  styles(): CSSResult {
    return css`
      .name {
        margin-left: 16px;
        font-size: 16px;
        color: DimGray;
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
        padding-left: 18px;
        margin-top: 5px;
        background-color: #e8e8e8;
        border-radius: 15px 15px 15px 15px;
        width: auto;
        height: 55px;
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
        line-height: 20px;
        padding: 1px 10px 1px 30px;
        display: inline-block;
        vertical-align: middle;
        text-align: right;
      }
      .boostup {
        color: #0000ff;
        font-size: 20px;
      }
      .boostdown {
        color: #ff0000;
        font-size: 20px;
      }
      .heating svg {
        fill: #ff811a;
      }
      .manual svg {
        fill: #109999;
      }
      .align-right {
        text-align: right;
      }
      .align-left {
        text-align: left;
      }
      .align-center {
        text-align: center;
      }
      .superscript {
        font-size: 17px;
        font-weight: 600;
        position: absolute;
        right: -5px;
        top: 15px;
      }
      .svg-icon svg {
        position: relative;
        top: 0%;
        -webkit-transform: perspective(1px) translateY(-20%);
        -ms-transform: perspective(1px) translateY(-20%);
        transform: perspective(1px) translateY(-20%);
      }
      .fallback {
        display: none;
      }
      .no-svg .fallback {
      }
    `;
  }
}

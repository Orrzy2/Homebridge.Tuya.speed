"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.miredToKelvin = exports.kelvinToMired = exports.kelvinToHSV = void 0;
const color_convert_1 = __importDefault(require("color-convert"));
const kelvin_to_rgb_1 = __importDefault(require("kelvin-to-rgb"));
function kelvinToHSV(kevin) {
    const [r, g, b] = (0, kelvin_to_rgb_1.default)(kevin);
    const [h, s, v] = color_convert_1.default.rgb.hsv(r, g, b);
    return { h, s, v };
}
exports.kelvinToHSV = kelvinToHSV;
// https://en.wikipedia.org/wiki/Mired
function kelvinToMired(kelvin) {
    return 1e6 / kelvin;
}
exports.kelvinToMired = kelvinToMired;
function miredToKelvin(mired) {
    return 1e6 / mired;
}
exports.miredToKelvin = miredToKelvin;
//# sourceMappingURL=color.js.map
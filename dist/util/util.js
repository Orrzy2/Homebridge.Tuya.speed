"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHapProperty = exports.limit = exports.remap = void 0;
function remap(value, srcStart, srcEnd, dstStart, dstEnd) {
    const percent = (value - srcStart) / (srcEnd - srcStart);
    const result = percent * (dstEnd - dstStart) + dstStart;
    return result;
}
exports.remap = remap;
function limit(value, start, end) {
    let result = value;
    result = Math.min(end, result);
    result = Math.max(start, result);
    return result;
}
exports.limit = limit;
function toHapProperty(property) {
    return Object.entries(property).reduce((hap, [key, value]) => {
        switch (key) {
            case 'min': {
                const multiple = Math.pow(10, property ? property['scale'] : 0);
                hap['minValue'] = Math.max(-273.15, value / multiple);
                break;
            }
            case 'max': {
                const multiple = Math.pow(10, property ? property['scale'] : 0);
                hap['maxValue'] = Math.min(400, value / multiple);
                break;
            }
            case 'step': {
                const multiple = Math.pow(10, property ? property['scale'] : 0);
                hap['minStep'] = Math.max(0.01, value / multiple);
                break;
            }
            case 'range': {
                hap['validValues'] = value;
                break;
            }
            default: {
                hap[key] = value;
                break;
            }
        }
        return hap;
    }, {});
}
exports.toHapProperty = toHapProperty;
//# sourceMappingURL=util.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureOutletInUse = void 0;
function configureOutletInUse(accessory, service, schema) {
    var _a;
    if (!schema) {
        return;
    }
    const test = (_a = accessory.getStatus(schema.code)) === null || _a === void 0 ? void 0 : _a.value;
    service === null || service === void 0 ? void 0 : service.getCharacteristic(accessory.Characteristic.OutletInUse).onGet(() => {
        return test ? true : false;
    });
}
exports.configureOutletInUse = configureOutletInUse;
//# sourceMappingURL=OutletInUse.js.map
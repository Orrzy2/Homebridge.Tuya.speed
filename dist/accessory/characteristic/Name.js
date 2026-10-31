"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureName = void 0;
function configureName(accessory, service, name) {
    service.setCharacteristic(accessory.Characteristic.Name, name);
    if (!service.testCharacteristic(accessory.Characteristic.ConfiguredName)) {
        service.addOptionalCharacteristic(accessory.Characteristic.ConfiguredName); // silence warning
        service.setCharacteristic(accessory.Characteristic.ConfiguredName, name); // only add once
    }
}
exports.configureName = configureName;
//# sourceMappingURL=Name.js.map
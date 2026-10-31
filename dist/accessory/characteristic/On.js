"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureOn = void 0;
function configureOn(accessory, service, schema) {
    if (!schema) {
        return;
    }
    if (!service) {
        service = accessory.accessory.getService(schema.code)
            || accessory.accessory.addService(accessory.Service.Switch, schema.code, schema.code);
    }
    service.getCharacteristic(accessory.Characteristic.On)
        .onGet(() => {
        accessory.checkOnlineStatus();
        const status = accessory.getStatus(schema.code);
        return status.value;
    })
        .onSet(async (value) => {
        await accessory.sendCommands([{
                code: schema.code,
                value: value,
            }], true);
    });
}
exports.configureOn = configureOn;
//# sourceMappingURL=On.js.map
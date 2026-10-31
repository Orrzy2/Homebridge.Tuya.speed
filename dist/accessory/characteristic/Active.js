"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureActive = void 0;
function configureActive(accessory, service, schema) {
    if (!schema) {
        return;
    }
    const { ACTIVE, INACTIVE } = accessory.Characteristic.Active;
    service.getCharacteristic(accessory.Characteristic.Active)
        .onGet(() => {
        accessory.checkOnlineStatus();
        const status = accessory.getStatus(schema.code);
        return status.value ? ACTIVE : INACTIVE;
    })
        .onSet(async (value) => {
        await accessory.sendCommands([{
                code: schema.code,
                value: (value === ACTIVE) ? true : false,
            }], true);
    });
}
exports.configureActive = configureActive;
//# sourceMappingURL=Active.js.map
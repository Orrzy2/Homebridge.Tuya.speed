"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureSecuritySystemTargetState = exports.configureSecuritySystemCurrentState = void 0;
const TUYA_CODES = {
    MASTER_MODE: {
        ARMED: 'arm',
        DISARMED: 'disarmed',
        HOME: 'home',
    },
};
function getTuyaHomebridgeMap(accessory) {
    const tuyaHomebridgeMap = new Map();
    tuyaHomebridgeMap.set(TUYA_CODES.MASTER_MODE.ARMED, accessory.Characteristic.SecuritySystemCurrentState.AWAY_ARM);
    tuyaHomebridgeMap.set(TUYA_CODES.MASTER_MODE.DISARMED, accessory.Characteristic.SecuritySystemCurrentState.DISARMED);
    tuyaHomebridgeMap.set(TUYA_CODES.MASTER_MODE.HOME, accessory.Characteristic.SecuritySystemCurrentState.STAY_ARM);
    tuyaHomebridgeMap.set(accessory.Characteristic.SecuritySystemCurrentState.AWAY_ARM, TUYA_CODES.MASTER_MODE.ARMED);
    tuyaHomebridgeMap.set(accessory.Characteristic.SecuritySystemCurrentState.DISARMED, TUYA_CODES.MASTER_MODE.DISARMED);
    tuyaHomebridgeMap.set(accessory.Characteristic.SecuritySystemCurrentState.STAY_ARM, TUYA_CODES.MASTER_MODE.HOME);
    tuyaHomebridgeMap.set(accessory.Characteristic.SecuritySystemCurrentState.NIGHT_ARM, TUYA_CODES.MASTER_MODE.HOME);
    return tuyaHomebridgeMap;
}
function configureSecuritySystemCurrentState(accessory, service, masterModeSchema, sosStateSchema) {
    if (!masterModeSchema || !sosStateSchema) {
        return;
    }
    const tuyaHomebridgeMap = getTuyaHomebridgeMap(accessory);
    service.getCharacteristic(accessory.Characteristic.SecuritySystemCurrentState)
        .onGet(() => {
        const alarmTriggered = accessory.getStatus(sosStateSchema.code).value;
        if (alarmTriggered) {
            return accessory.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
        }
        else {
            const currentState = accessory.getStatus(masterModeSchema.code).value;
            if (currentState === TUYA_CODES.MASTER_MODE.HOME) {
                return accessory.isNightArm ? accessory.Characteristic.SecuritySystemCurrentState.NIGHT_ARM :
                    accessory.Characteristic.SecuritySystemCurrentState.STAY_ARM;
            }
            return tuyaHomebridgeMap.get(currentState);
        }
    });
}
exports.configureSecuritySystemCurrentState = configureSecuritySystemCurrentState;
function configureSecuritySystemTargetState(accessory, service, masterModeSchema, sosStateSchema) {
    if (!masterModeSchema || !sosStateSchema) {
        return;
    }
    const tuyaHomebridgeMap = getTuyaHomebridgeMap(accessory);
    service.getCharacteristic(accessory.Characteristic.SecuritySystemTargetState)
        .onGet(() => {
        const currentState = accessory.getStatus(masterModeSchema.code).value;
        if (currentState === TUYA_CODES.MASTER_MODE.HOME) {
            return accessory.isNightArm ? accessory.Characteristic.SecuritySystemCurrentState.NIGHT_ARM :
                accessory.Characteristic.SecuritySystemCurrentState.STAY_ARM;
        }
        return tuyaHomebridgeMap.get(currentState);
    })
        .onSet(async (value) => {
        var _a;
        const sosState = (_a = accessory.getStatus(sosStateSchema.code)) === null || _a === void 0 ? void 0 : _a.value;
        // If we received a request to disarm the alarm, we make sure sos_state is set to false
        if (sosState && value === accessory.Characteristic.SecuritySystemTargetState.DISARM) {
            await accessory.sendCommands([{
                    code: sosStateSchema.code,
                    value: false,
                }], true);
        }
        accessory.isNightArm = value === accessory.Characteristic.SecuritySystemTargetState.NIGHT_ARM;
        await accessory.sendCommands([{
                code: masterModeSchema.code,
                value: tuyaHomebridgeMap.get(value),
            }], true);
    });
}
exports.configureSecuritySystemTargetState = configureSecuritySystemTargetState;
//# sourceMappingURL=SecuritySystemState.js.map
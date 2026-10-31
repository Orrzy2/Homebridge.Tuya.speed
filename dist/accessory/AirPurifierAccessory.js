"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModeSpeedLevels = void 0;
const TuyaDevice_1 = require("../device/TuyaDevice");
const BaseAccessory_1 = __importDefault(require("./BaseAccessory"));
const Active_1 = require("./characteristic/Active");
const AirQuality_1 = require("./characteristic/AirQuality");
const LockPhysicalControls_1 = require("./characteristic/LockPhysicalControls");
const RotationSpeed_1 = require("./characteristic/RotationSpeed");
const SCHEMA_CODE = {
    ACTIVE: ['switch'],
    MODE: ['mode'],
    LOCK: ['lock'],
    SPEED: ['speed'],
    SPEED_LEVEL: ['fan_speed_enum', 'speed'],
    AIR_QUALITY: ['air_quality', 'pm25'],
    PM2_5: ['pm25'],
    VOC: ['tvoc'],
};
// Fan speed levels embedded in the `mode` enum, e.g. ["auto", "sleep", "1F", "2F", "3F", "4F"].
const MODE_SPEED_LEVEL = /^(\d+)F$/i;
const MODE_SPEED_SLEEP = 'sleep';
/**
 * Returns the ordered speed steps found in a `mode` enum range ("sleep" first, then 1F, 2F, ...),
 * or undefined when the range does not follow that pattern (needs at least 2 numbered levels).
 */
function getModeSpeedLevels(range) {
    if (!Array.isArray(range)) {
        return undefined;
    }
    const levels = range
        .filter(value => MODE_SPEED_LEVEL.test(value))
        .sort((a, b) => parseInt(a) - parseInt(b));
    if (levels.length < 2) {
        return undefined;
    }
    const sleep = range.find(value => value.toLowerCase() === MODE_SPEED_SLEEP);
    return sleep ? [sleep, ...levels] : levels;
}
exports.getModeSpeedLevels = getModeSpeedLevels;
class AirPurifierAccessory extends BaseAccessory_1.default {
    requiredSchema() {
        return [SCHEMA_CODE.ACTIVE];
    }
    configureServices() {
        (0, Active_1.configureActive)(this, this.mainService(), this.getSchema(...SCHEMA_CODE.ACTIVE));
        this.configureCurrentState();
        this.configureTargetState();
        (0, LockPhysicalControls_1.configureLockPhysicalControls)(this, this.mainService(), this.getSchema(...SCHEMA_CODE.LOCK));
        if (this.getFanSpeedSchema()) {
            (0, RotationSpeed_1.configureRotationSpeed)(this, this.mainService(), this.getFanSpeedSchema());
        }
        else if (this.getFanSpeedLevelSchema()) {
            (0, RotationSpeed_1.configureRotationSpeedLevel)(this, this.mainService(), this.getFanSpeedLevelSchema());
        }
        else if (this.getModeSpeedSchema()) {
            (0, RotationSpeed_1.configureRotationSpeedLevel)(this, this.mainService(), this.getModeSpeedSchema());
        }
        // Other
        (0, AirQuality_1.configureAirQuality)(this, undefined, this.getSchema(...SCHEMA_CODE.AIR_QUALITY), this.getSchema(...SCHEMA_CODE.PM2_5), undefined, this.getSchema(...SCHEMA_CODE.VOC));
    }
    mainService() {
        return this.accessory.getService(this.Service.AirPurifier)
            || this.accessory.addService(this.Service.AirPurifier);
    }
    getFanSpeedSchema() {
        const schema = this.getSchema(...SCHEMA_CODE.SPEED);
        if (schema && schema.type === TuyaDevice_1.TuyaDeviceSchemaType.Integer) {
            return schema;
        }
        return undefined;
    }
    getFanSpeedLevelSchema() {
        const schema = this.getSchema(...SCHEMA_CODE.SPEED_LEVEL);
        if (schema && schema.type === TuyaDevice_1.TuyaDeviceSchemaType.Enum) {
            return schema;
        }
        return undefined;
    }
    /**
     * For purifiers without a speed DP whose `mode` enum carries the fan levels,
     * returns a copy of the `mode` schema restricted to the speed steps (auto excluded).
     */
    getModeSpeedSchema() {
        const schema = this.getSchema(...SCHEMA_CODE.MODE);
        if (!schema || schema.type !== TuyaDevice_1.TuyaDeviceSchemaType.Enum) {
            return undefined;
        }
        const levels = getModeSpeedLevels(schema.property.range);
        if (!levels) {
            return undefined;
        }
        return { ...schema, property: { range: levels } };
    }
    getManualModeValue(schema) {
        var _a, _b;
        const range = ((_a = schema.property) === null || _a === void 0 ? void 0 : _a.range) || [];
        if (range.includes('manual')) {
            return 'manual';
        }
        if (!this.getFanSpeedSchema() && !this.getFanSpeedLevelSchema()) {
            const levels = getModeSpeedLevels(range);
            if (levels) {
                // Already on a manual speed: keep it. Otherwise start at the lowest numbered level (e.g. 1F).
                const current = (_b = this.getStatus(schema.code)) === null || _b === void 0 ? void 0 : _b.value;
                if (levels.includes(current)) {
                    return current;
                }
                return levels.find(value => MODE_SPEED_LEVEL.test(value));
            }
        }
        return 'manual';
    }
    configureCurrentState() {
        const schema = this.getSchema(...SCHEMA_CODE.ACTIVE);
        if (!schema) {
            return;
        }
        const { INACTIVE, PURIFYING_AIR } = this.Characteristic.CurrentAirPurifierState;
        this.mainService().getCharacteristic(this.Characteristic.CurrentAirPurifierState)
            .onGet(() => {
            const status = this.getStatus(schema.code);
            return status.value ? PURIFYING_AIR : INACTIVE;
        });
    }
    configureTargetState() {
        const schema = this.getSchema(...SCHEMA_CODE.MODE);
        if (!schema) {
            return;
        }
        const { MANUAL, AUTO } = this.Characteristic.TargetAirPurifierState;
        this.mainService().getCharacteristic(this.Characteristic.TargetAirPurifierState)
            .onGet(() => {
            const status = this.getStatus(schema.code);
            return (status.value === 'auto') ? AUTO : MANUAL;
        })
            .onSet(async (value) => {
            await this.sendCommands([{
                    code: schema.code,
                    value: (value === AUTO) ? 'auto' : this.getManualModeValue(schema),
                }], true);
        });
    }
}
exports.default = AirPurifierAccessory;
//# sourceMappingURL=AirPurifierAccessory.js.map
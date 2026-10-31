"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TuyaDevice_1 = require("../device/TuyaDevice");
const BaseAccessory_1 = __importDefault(require("./BaseAccessory"));
const Name_1 = require("./characteristic/Name");
const On_1 = require("./characteristic/On");
const EnergyUsage_1 = require("./characteristic/EnergyUsage");
const CurrentTemperature_1 = require("./characteristic/CurrentTemperature");
const CurrentRelativeHumidity_1 = require("./characteristic/CurrentRelativeHumidity");
const SCHEMA_CODE = {
    ON: ['switch', 'switch_1'],
    CURRENT: ['cur_current'],
    POWER: ['cur_power'],
    VOLTAGE: ['cur_voltage'],
    TOTAL_POWER: ['add_ele'],
    CURRENT_TEMP: ['va_temperature', 'temp_current'],
    CURRENT_HUMIDITY: ['va_humidity', 'humidity_value'],
    INCHING: ['switch_inching'],
};
class SwitchAccessory extends BaseAccessory_1.default {
    requiredSchema() {
        return [SCHEMA_CODE.ON];
    }
    configureServices() {
        const oldService = this.accessory.getService(this.mainService());
        if (oldService && (oldService === null || oldService === void 0 ? void 0 : oldService.subtype) === undefined) {
            this.platform.log.warn('Remove old service:', oldService.UUID);
            this.accessory.removeService(oldService);
        }
        const schemata = this.device.schema.filter((schema) => schema.code.startsWith('switch') && schema.type === TuyaDevice_1.TuyaDeviceSchemaType.Boolean);
        schemata.forEach((schema) => {
            const name = (schemata.length === 1) ? this.device.name : schema.code;
            this.configureSwitch(schema, name);
        });
        // Other
        (0, CurrentTemperature_1.configureCurrentTemperature)(this, undefined, this.getSchema(...SCHEMA_CODE.CURRENT_TEMP));
        (0, CurrentRelativeHumidity_1.configureCurrentRelativeHumidity)(this, undefined, this.getSchema(...SCHEMA_CODE.CURRENT_HUMIDITY));
        this.configureInching();
    }
    mainService() {
        return this.Service.Switch;
    }
    configureSwitch(schema, name) {
        var _a;
        const service = this.accessory.getService(schema.code)
            || this.accessory.addService(this.mainService(), name, schema.code);
        (0, Name_1.configureName)(this, service, name);
        (0, On_1.configureOn)(this, service, schema);
        if (schema.code === ((_a = this.getSchema(...SCHEMA_CODE.ON)) === null || _a === void 0 ? void 0 : _a.code)) {
            (0, EnergyUsage_1.configureEnergyUsage)(this.platform.api, this, service, this.getSchema(...SCHEMA_CODE.CURRENT), this.getSchema(...SCHEMA_CODE.POWER), this.getSchema(...SCHEMA_CODE.VOLTAGE), this.getSchema(...SCHEMA_CODE.TOTAL_POWER));
        }
    }
    configureInching() {
        const schema = this.getSchema(...SCHEMA_CODE.INCHING);
        if (!schema || schema.type !== TuyaDevice_1.TuyaDeviceSchemaType.String) {
            return;
        }
        const service = this.accessory.getService(schema.code)
            || this.accessory.addService(this.Service.Switch, schema.code, schema.code);
        (0, Name_1.configureName)(this, service, schema.code);
        service.getCharacteristic(this.Characteristic.On)
            .onGet(() => {
            this.checkOnlineStatus();
            const status = this.getStatus(schema.code);
            const buffer = Buffer.from(status.value, 'base64');
            return (buffer.length === 3) && (buffer[0] === 1);
        })
            .onSet(async (value) => {
            const status = this.getStatus(schema.code);
            let buffer = Buffer.from(status.value, 'base64');
            if (buffer.length !== 3) {
                buffer = Buffer.alloc(3);
            }
            buffer[0] = value ? 1 : 0;
            await this.sendCommands([{
                    code: schema.code,
                    value: buffer.toString('base64'),
                }], true);
        });
    }
}
exports.default = SwitchAccessory;
//# sourceMappingURL=SwitchAccessory.js.map
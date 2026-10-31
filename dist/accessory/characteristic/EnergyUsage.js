"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAmperesCharacteristic = exports.configureEnergyUsage = void 0;
function configureEnergyUsage(api, accessory, service, currentSchema, powerSchema, voltageSchema, totalSchema) {
    if (currentSchema) {
        const amperes = createAmperesCharacteristic(api);
        if (!service.testCharacteristic(amperes)) {
            service.addCharacteristic(amperes);
        }
        service.getCharacteristic(amperes).onGet(createStatusGetter(accessory, currentSchema, isUnit(currentSchema, 'mA') ? 1000 : 0));
    }
    if (powerSchema) {
        const watts = createWattsCharacteristic(api);
        if (!service.testCharacteristic(watts)) {
            service.addCharacteristic(watts);
        }
        service.getCharacteristic(watts).onGet(createStatusGetter(accessory, powerSchema));
    }
    if (voltageSchema) {
        const volts = createVoltsCharacteristic(api);
        if (!service.testCharacteristic(volts)) {
            service.addCharacteristic(volts);
        }
        service.getCharacteristic(volts).onGet(createStatusGetter(accessory, voltageSchema));
    }
    if (totalSchema) {
        const kwh = createKilowattHourCharacteristic(api);
        if (!service.testCharacteristic(kwh)) {
            service.addCharacteristic(kwh);
        }
        service.getCharacteristic(kwh).onGet(createStatusGetter(accessory, totalSchema));
    }
}
exports.configureEnergyUsage = configureEnergyUsage;
function isUnit(schema, ...units) {
    return units.includes(schema.property.unit);
}
function createStatusGetter(accessory, schema, divisor = 1) {
    const property = schema.property;
    divisor *= Math.pow(10, property.scale);
    return () => {
        const status = accessory.getStatus(schema.code);
        return status.value / divisor;
    };
}
function createAmperesCharacteristic(api) {
    var _a;
    return _a = class Amperes extends api.hap.Characteristic {
            constructor() {
                super('Amperes', Amperes.UUID, {
                    format: "float" /* api.hap.Formats.FLOAT */,
                    perms: ["ev" /* api.hap.Perms.NOTIFY */, "pr" /* api.hap.Perms.PAIRED_READ */],
                    unit: 'A',
                });
            }
        },
        _a.UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52',
        _a;
}
exports.createAmperesCharacteristic = createAmperesCharacteristic;
function createWattsCharacteristic(api) {
    var _a;
    return _a = class Watts extends api.hap.Characteristic {
            constructor() {
                super('Consumption', Watts.UUID, {
                    format: "float" /* api.hap.Formats.FLOAT */,
                    perms: ["ev" /* api.hap.Perms.NOTIFY */, "pr" /* api.hap.Perms.PAIRED_READ */],
                    unit: 'W',
                });
            }
        },
        _a.UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52',
        _a;
}
function createVoltsCharacteristic(api) {
    var _a;
    return _a = class Volts extends api.hap.Characteristic {
            constructor() {
                super('Volts', Volts.UUID, {
                    format: "float" /* api.hap.Formats.FLOAT */,
                    perms: ["ev" /* api.hap.Perms.NOTIFY */, "pr" /* api.hap.Perms.PAIRED_READ */],
                    unit: 'V',
                });
            }
        },
        _a.UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52',
        _a;
}
function createKilowattHourCharacteristic(api) {
    var _a;
    return _a = class KilowattHour extends api.hap.Characteristic {
            constructor() {
                super('Total Consumption', KilowattHour.UUID, {
                    format: "float" /* api.hap.Formats.FLOAT */,
                    perms: ["ev" /* api.hap.Perms.NOTIFY */, "pr" /* api.hap.Perms.PAIRED_READ */],
                    unit: 'kWh',
                });
            }
        },
        _a.UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52',
        _a;
}
//# sourceMappingURL=EnergyUsage.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const TuyaOpenMQ_1 = __importDefault(require("../core/TuyaOpenMQ"));
const Logger_1 = require("../util/Logger");
const TuyaDevice_1 = __importStar(require("./TuyaDevice"));
var Events;
(function (Events) {
    Events["DEVICE_ADD"] = "DEVICE_ADD";
    Events["DEVICE_INFO_UPDATE"] = "DEVICE_INFO_UPDATE";
    Events["DEVICE_STATUS_UPDATE"] = "DEVICE_STATUS_UPDATE";
    Events["DEVICE_DELETE"] = "DEVICE_DELETE";
})(Events || (Events = {}));
var TuyaMQTTProtocol;
(function (TuyaMQTTProtocol) {
    TuyaMQTTProtocol[TuyaMQTTProtocol["DEVICE_STATUS_UPDATE"] = 4] = "DEVICE_STATUS_UPDATE";
    TuyaMQTTProtocol[TuyaMQTTProtocol["DEVICE_INFO_UPDATE"] = 20] = "DEVICE_INFO_UPDATE";
})(TuyaMQTTProtocol || (TuyaMQTTProtocol = {}));
class TuyaDeviceManager extends events_1.default {
    constructor(api, debug = false) {
        super();
        this.api = api;
        this.debug = debug;
        this.ownerIDs = [];
        this.devices = [];
        const log = this.api.log.log;
        this.log = new Logger_1.PrefixLogger(log, TuyaDeviceManager.name, debug);
        this.mq = new TuyaOpenMQ_1.default(api, log);
        this.mq.addMessageListener(this.onMQTTMessage.bind(this));
    }
    createVirtualDevice(baseDevice, uuid) {
        const cloneDevice = new TuyaDevice_1.default(baseDevice);
        const uniqueId = uuid || Date.now().toString(36) + Math.random().toString(36).substring(2);
        cloneDevice.id = `${uniqueId}`;
        cloneDevice.uuid = `${uniqueId}`;
        cloneDevice.name = 'Virtual Device';
        cloneDevice.product_id = `${uniqueId}`;
        cloneDevice.product_name = 'virtual product';
        cloneDevice.sub = true;
        cloneDevice.ip = '';
        cloneDevice.parent_id = baseDevice.id;
        cloneDevice.remote_keys = undefined;
        return cloneDevice;
    }
    getDevice(deviceID) {
        return Array.from(this.devices).find(device => device.id === deviceID);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async updateDevices(ownerIDs) {
        return [];
    }
    async updateDevice(deviceID) {
        const res = await this.getDeviceInfo(deviceID);
        if (!res.success) {
            return null;
        }
        const device = new TuyaDevice_1.default(res.result);
        device.schema = await this.getDeviceSchema(deviceID);
        const oldDevice = this.getDevice(deviceID);
        if (oldDevice) {
            this.devices.splice(this.devices.indexOf(oldDevice), 1);
        }
        this.devices.push(device);
        return device;
    }
    async getDeviceInfo(deviceID) {
        const res = await this.api.get(`/v1.0/devices/${deviceID}`);
        return res;
    }
    async getDeviceListInfo(deviceIDs = []) {
        const res = await this.api.get('/v1.0/devices', { 'device_ids': deviceIDs.join(',') });
        return res;
    }
    async getDeviceSchema(deviceID) {
        // const res = await this.api.get(`/v1.2/iot-03/devices/${deviceID}/specification`);
        const res = await this.api.get(`/v1.0/devices/${deviceID}/specifications`);
        if (res.success === false) {
            this.log.warn('Get device specification failed. devId = %s, code = %s, msg = %s', deviceID, res.code, res.msg);
            return [];
        }
        // Combine functions and status together, as it used to be.
        const schemas = new Map();
        for (const { code, type, values } of [...res.result.status, ...res.result.functions]) {
            if (schemas[code]) {
                continue;
            }
            const read = (res.result.status).find(schema => schema.code === code) !== undefined;
            const write = (res.result.functions).find(schema => schema.code === code) !== undefined;
            let mode = TuyaDevice_1.TuyaDeviceSchemaMode.UNKNOWN;
            if (read && write) {
                mode = TuyaDevice_1.TuyaDeviceSchemaMode.READ_WRITE;
            }
            else if (read && !write) {
                mode = TuyaDevice_1.TuyaDeviceSchemaMode.READ_ONLY;
            }
            else if (!read && write) {
                mode = TuyaDevice_1.TuyaDeviceSchemaMode.WRITE_ONLY;
            }
            let property;
            try {
                property = JSON.parse(values);
                schemas[code] = { code, mode, type, property };
            }
            catch (error) {
                // ignore infrared remote's invalid schema because it's not used.
            }
        }
        // Some products (e.g. air purifiers whose fan speed lives in the `mode` enum) only publish a
        // reduced enum range in the standard instruction set. Widen it with the device's thing model.
        if (res.result.category === 'kj') {
            await this.mergeThingModelEnumRanges(deviceID, schemas);
        }
        return Object.values(schemas).sort((a, b) => a.code > b.code ? 1 : -1);
    }
    async getDeviceThingModel(deviceID) {
        const res = await this.api.get(`/v2.0/cloud/thing/${deviceID}/model`);
        if (!res || res.success === false || !res.result || !res.result.model) {
            return undefined;
        }
        try {
            return typeof res.result.model === 'string' ? JSON.parse(res.result.model) : res.result.model;
        }
        catch (error) {
            return undefined;
        }
    }
    async mergeThingModelEnumRanges(deviceID, schemas) {
        let model;
        try {
            model = await this.getDeviceThingModel(deviceID);
        }
        catch (error) {
            this.log.debug('Get thing model failed. devId = %s, error = %s', deviceID, error);
            return;
        }
        if (!model || !Array.isArray(model.services)) {
            return;
        }
        for (const service of model.services) {
            for (const property of (service.properties || [])) {
                const schema = schemas[property.code];
                const typeSpec = property.typeSpec;
                if (!schema || schema.type !== TuyaDevice_1.TuyaDeviceSchemaType.Enum
                    || !typeSpec || typeSpec.type !== 'enum' || !Array.isArray(typeSpec.range)) {
                    continue;
                }
                const oldRange = schema.property.range || [];
                const newRange = [...typeSpec.range];
                for (const value of oldRange) {
                    if (!newRange.includes(value)) {
                        newRange.push(value);
                    }
                }
                if (newRange.length > oldRange.length) {
                    this.log.debug('Widen enum range of %s.%s from thing model: %o => %o', deviceID, schema.code, oldRange, newRange);
                    schema.property = { ...schema.property, range: newRange };
                }
            }
        }
    }
    async getInfraredRemotes(infraredID) {
        const res = await this.api.get(`/v2.0/infrareds/${infraredID}/remotes`);
        return res;
    }
    async getInfraredKeys(infraredID, remoteID) {
        const res = await this.api.get(`/v2.0/infrareds/${infraredID}/remotes/${remoteID}/keys`);
        return res;
    }
    async getInfraredACStatus(infraredID, remoteID) {
        const res = await this.api.get(`/v2.0/infrareds/${infraredID}/remotes/${remoteID}/ac/status`);
        return res;
    }
    async getInfraredDIYKeys(infraredID, remoteID) {
        const res = await this.api.get(`/v2.0/infrareds/${infraredID}/remotes/${remoteID}/learning-codes`);
        return res;
    }
    resolveInfraredRemotes(parentDevice, allDevices) {
        const isInfraredRemoteDevice = (parent, target) => {
            if (!target.sub || !target.category.startsWith('infrared_')) {
                return false;
            }
            if (parent.lat === target.lat && parent.lon === target.lon) {
                return true;
            }
            if (parent.update_time === target.update_time) {
                return true;
            }
            return false;
        };
        const infraredRemotes = allDevices.filter(device => {
            return isInfraredRemoteDevice(parentDevice, device);
        }).map(device => {
            return {
                'category_id': 999,
                'remote_id': device.id,
                'resolved': true,
            };
        });
        return infraredRemotes;
    }
    fixInfraredDevice(subDevice) {
        subDevice.remote_keys.org_category_id = subDevice.remote_keys.category_id;
        subDevice.remote_keys.category_id = this.resolveHAPCategoryID(subDevice);
    }
    resolveHAPCategoryID(subDevice) {
        var _a, _b;
        this.log.debug(`resolve HAP category ID. subDevice category:${subDevice.category}, categoryID:${(_a = subDevice.remote_keys) === null || _a === void 0 ? void 0 : _a.category_id}`);
        let category_id;
        switch (subDevice.product_id) {
            case 'prsgoryjfdtb42r4':
                category_id = 8; // Fan
                break;
            case 'k6ozylayfgnskuq6':
                category_id = 999; // DIY
                break;
            default:
                category_id = ((_b = subDevice.remote_keys) === null || _b === void 0 ? void 0 : _b.category_id) || 999; // DIY;
        }
        this.log.debug(`resolved HAP category ID:${category_id}`);
        return category_id;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dump(obj) {
        for (const key in obj) {
            try {
                if ((typeof obj[key]) === 'function') {
                    this.log.warn(`\t function ${key}:${obj[key].name}`);
                }
                else {
                    this.log.warn(`\t ${key}:${obj[key]}`);
                }
            }
            catch (e) {
                this.dump(e);
            }
            if ((typeof obj[key]) !== 'string') {
                for (const key2 in obj[key]) {
                    try {
                        if ((typeof obj[key][key2]) === 'function') {
                            this.log.warn(`\t function ${key2}:${obj[key][key2].name}`);
                        }
                        else {
                            this.log.warn(`\t ${key2}:${obj[key][key2]}`);
                        }
                    }
                    catch (e) {
                        this.dump(e);
                    }
                }
            }
        }
    }
    async updateInfraredRemotes(allDevices) {
        var _a, _b, _c, _d, _e;
        const irDevices = allDevices.filter(device => device.isIRControlHub());
        for (const irDevice of irDevices) {
            const res = await this.getInfraredRemotes(irDevice.id);
            if (!res.success) {
                this.log.warn('Get infrared remotes failed. deviceId = %s, code = %s, msg = %s', irDevice.id, res.code, res.msg);
                continue;
            }
            let resResult = res.result;
            for (const resolvedRemoteDevice of this.resolveInfraredRemotes(irDevice, allDevices)) {
                resResult.forEach(remoteDevice => {
                    if (remoteDevice.remote_id === resolvedRemoteDevice.remote_id) {
                        remoteDevice.org_category_id = remoteDevice.category_id;
                        remoteDevice.category_id = resolvedRemoteDevice.category_id;
                        remoteDevice.resolved = true;
                    }
                });
            }
            if (resResult.length === 0) {
                // for legacy devices
                this.log.warn('no result for Get infrared remotes.');
                this.log.info('resolving infrared remotes from device list...');
                resResult = this.resolveInfraredRemotes(irDevice, allDevices);
                this.log.success(`${resResult.length} infrared remote device found.`);
            }
            for (const { category_id, remote_id, resolved } of resResult) {
                const subDevice = allDevices.find(device => device.id === remote_id);
                if (!subDevice) {
                    continue;
                }
                subDevice.parent_id = irDevice.id;
                subDevice.schema = [];
                const res = await this.getInfraredKeys(irDevice.id, subDevice.id);
                if (!res.success) {
                    this.log.warn('Get infrared remote keys failed. deviceId = %s, code = %s, msg = %s', subDevice.id, res.code, res.msg);
                    continue;
                }
                subDevice.remote_keys = res.result || {};
                this.log.debug(`infrared keys lengh:${(_b = (_a = subDevice.remote_keys) === null || _a === void 0 ? void 0 : _a.key_list) === null || _b === void 0 ? void 0 : _b.length}`);
                if (resolved) {
                    this.fixInfraredDevice(subDevice);
                }
                if (subDevice.category === 'infrared_ac') { // AC Device
                    const res = await this.getInfraredACStatus(irDevice.id, subDevice.id);
                    if (!res.success) {
                        this.log.warn('Get infrared ac status failed. deviceId = %s, code = %s, msg = %s', subDevice.id, res.code, res.msg);
                        continue;
                    }
                    subDevice.status = Object.entries(res.result).map(([key, value]) => ({ code: key, value }));
                }
                else if (category_id === 999) { // DIY Device
                    const res = await this.getInfraredDIYKeys(irDevice.id, subDevice.id);
                    if (!res.success) {
                        this.log.warn('Get infrared diy keys failed. deviceId = %s, code = %s, msg = %s', subDevice.id, res.code, res.msg);
                        continue;
                    }
                    const key_list = ((_c = subDevice.remote_keys) === null || _c === void 0 ? void 0 : _c.key_list) || [];
                    this.log.debug(`key list length:${key_list.length}`);
                    const ignoreList = [];
                    for (const key of key_list) {
                        if (key.standard_key) {
                            if (resolved) {
                                ignoreList.push(key);
                            }
                            continue;
                        }
                        const item = res.result.find(item => item['id'] === key.key_id && item['key'] === key.key);
                        if (!item) {
                            if (resolved) {
                                ignoreList.push(key);
                            }
                            continue;
                        }
                        this.log.debug('learning_code:', item['code']);
                        key.learning_code = item['code'];
                    }
                    if (subDevice.remote_keys && ignoreList.length !== 0) {
                        this.log.debug('remove standard instructions. not need for DIY Device');
                        subDevice.remote_keys.key_list = (_d = subDevice.remote_keys) === null || _d === void 0 ? void 0 : _d.key_list.filter(item => !ignoreList.includes(item));
                        this.log.debug(`new key list length:${(_e = subDevice.remote_keys) === null || _e === void 0 ? void 0 : _e.key_list.length}`);
                    }
                }
            }
        }
    }
    async sendInfraredCommands(infraredID, remoteID, category_id, remote_index, key, key_id) {
        const res = await this.api.post(`/v2.0/infrareds/${infraredID}/remotes/${remoteID}/raw/command`, {
            category_id, remote_index, key, key_id,
        });
        return res;
    }
    async sendInfraredACCommands(infraredID, remoteID, power, mode, temp, wind) {
        const commands = (power === 1) ? { power, mode, temp, wind } : { power };
        const res = await this.api.post(`/v2.0/infrareds/${infraredID}/air-conditioners/${remoteID}/scenes/command`, commands);
        if (!res.success) {
            this.log.info('Send AC command failed. code = %d, msg = %s', res.code, res.msg);
        }
        return res;
    }
    async sendInfraredDIYCommands(infraredID, remoteID, code) {
        const res = await this.api.post(`/v2.0/infrareds/${infraredID}/remotes/${remoteID}/learning-codes`, { code });
        // const res = await this.api.post(`/v1.0/infrareds/${infraredID}/remotes/${remoteID}/learning-codes`, { code });
        return res;
    }
    async getLockTemporaryKey(deviceID) {
        // const res = await this.api.post(`/v1.0/smart-lock/devices/${deviceID}/door-lock/password-ticket`);
        const res = await this.api.post(`/v1.0/smart-lock/devices/${deviceID}/password-ticket`);
        if (res.success === false) {
            this.log.warn('Get Temporary Pass failed. devID = %s, code = %s, msg = %s', deviceID, res.code, res.msg);
        }
        return res;
    }
    async sendLockCommands(deviceID, ticketID, open) {
        const res = await this.api.post(`/v1.0/smart-lock/devices/${deviceID}/password-free/door-operate`, {
            device_id: deviceID,
            ticket_id: ticketID,
            open,
        });
        return res;
    }
    async sendCommands(deviceID, commands) {
        const res = await this.api.post(`/v1.0/devices/${deviceID}/commands`, { commands });
        if (res && res.success === false && res.code === 2008) {
            // "command or value not support": the standard instruction set rejected the value
            // (e.g. a `mode` value missing from the published range). Retry via the thing model API,
            // which accepts every value the device itself supports.
            this.log.debug('Standard command rejected (2008), retry via thing model. devId = %s', deviceID);
            return await this.sendPropertiesIssue(deviceID, commands);
        }
        return res.result;
    }
    async sendPropertiesIssue(deviceID, commands) {
        const properties = {};
        for (const { code, value } of commands) {
            properties[code] = value;
        }
        const res = await this.api.post(`/v2.0/cloud/thing/${deviceID}/shadow/properties/issue`, {
            properties: JSON.stringify(properties),
        });
        if (res && res.success === false) {
            this.log.warn('Send properties failed. devId = %s, code = %s, msg = %s', deviceID, res.code, res.msg);
        }
        return res.result;
    }
    async getCurrentWeather(lat, lon) {
        const res = await this.api.get(`/v2.0/iot-03/weather/current?lat=${lat}&lon=${lon}`);
        return res.result;
    }
    async getCurrentWeatherByOpenMeteo(lat, lon) {
        /** <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a> */
        // eslint-disable-next-line max-len
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`, { cache: 'no-cache' });
        return await res.json();
    }
    async onMQTTMessage(topic, protocol, message) {
        switch (protocol) {
            case TuyaMQTTProtocol.DEVICE_STATUS_UPDATE: {
                const { devId, status } = message;
                const device = this.getDevice(devId);
                if (!device) {
                    return;
                }
                for (const item of device.status) {
                    const _item = status.find(_item => _item.code === item.code);
                    if (!_item) {
                        continue;
                    }
                    item.value = _item.value;
                }
                this.emit(Events.DEVICE_STATUS_UPDATE, device, status);
                break;
            }
            case TuyaMQTTProtocol.DEVICE_INFO_UPDATE: {
                const { bizCode, bizData, devId } = message;
                if (bizCode === 'bindUser') {
                    const { ownerId } = bizData;
                    if (!this.ownerIDs.includes(ownerId)) {
                        this.log.warn('Update devId = %s not included in your ownerIDs. Skip.', devId);
                        return;
                    }
                    // TODO failed if request to quickly
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    const device = await this.updateDevice(devId);
                    if (!device) {
                        return;
                    }
                    this.mq.start(); // Force reconnect, unless new device status update won't get received
                    this.emit(Events.DEVICE_ADD, device);
                }
                else if (bizCode === 'nameUpdate') {
                    const { name } = bizData;
                    const device = this.getDevice(devId);
                    if (!device) {
                        return;
                    }
                    device.name = name;
                    this.emit(Events.DEVICE_INFO_UPDATE, device, bizData);
                }
                else if (bizCode === 'online' || bizCode === 'offline') {
                    const device = this.getDevice(devId);
                    if (!device) {
                        return;
                    }
                    device.online = (bizCode === 'online') ? true : false;
                    this.emit(Events.DEVICE_INFO_UPDATE, device, bizData);
                }
                else if (bizCode === 'delete') {
                    const { ownerId } = bizData;
                    if (!this.ownerIDs.includes(ownerId)) {
                        this.log.warn('Remove devId = %s not included in your ownerIDs. Skip.', devId);
                        return;
                    }
                    const device = this.getDevice(devId);
                    if (!device) {
                        return;
                    }
                    this.devices.splice(this.devices.indexOf(device), 1);
                    this.emit(Events.DEVICE_DELETE, devId);
                }
                else if (bizCode === 'event_notify') {
                    // doorbell event
                }
                else if (bizCode === 'p2pSignal') {
                    // p2p signal
                }
                else {
                    this.log.warn('Unhandled mqtt message: bizCode = %s, bizData = %o', bizCode, bizData);
                }
                break;
            }
            default:
                this.log.warn('Unhandled mqtt message: protocol = %s, message = %o', protocol, message);
                break;
        }
    }
}
exports.default = TuyaDeviceManager;
TuyaDeviceManager.Events = Events;
//# sourceMappingURL=TuyaDeviceManager.js.map
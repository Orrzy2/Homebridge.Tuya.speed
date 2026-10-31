"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TuyaDevice_1 = __importDefault(require("./TuyaDevice"));
const TuyaDeviceManager_1 = __importDefault(require("./TuyaDeviceManager"));
class TuyaCustomDeviceManager extends TuyaDeviceManager_1.default {
    constructor(api, debug = false) {
        super(api, debug);
        this.api = api;
        this.debug = debug;
        this.mq.version = '2.0';
    }
    async getAssetList(parent_asset_id = -1) {
        // const res = await this.api.get('/v1.0/iot-03/users/assets', {
        const res = await this.api.get(`/v1.0/iot-02/assets/${parent_asset_id}/sub-assets`, {
            'page_no': 0,
            'page_size': 100,
        });
        return res;
    }
    async authorizeAssetList(uid, asset_ids = [], authorized_children = false) {
        const res = await this.api.post(`/v1.0/iot-03/users/${uid}/actions/batch-assets-authorized`, {
            asset_ids: asset_ids.join(','),
            authorized_children,
        });
        return res;
    }
    async getAssetDeviceIDList(assetID) {
        let deviceIDs = [];
        const params = {
            page_size: 50,
        };
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const res = await this.api.get(`/v1.0/iot-02/assets/${assetID}/devices`, params);
            deviceIDs = deviceIDs.concat(res.result.list.map(item => item['device_id']));
            params['last_row_key'] = res.result.last_row_key;
            if (!res.result.has_next) {
                break;
            }
        }
        return deviceIDs;
    }
    async updateDevices(assetIDList) {
        let deviceIDs = [];
        for (const assetID of assetIDList) {
            deviceIDs = deviceIDs.concat(await this.getAssetDeviceIDList(assetID));
        }
        if (deviceIDs.length === 0) {
            return [];
        }
        const res = await this.getDeviceListInfo(deviceIDs);
        const devices = res.result.devices.map(obj => new TuyaDevice_1.default(obj));
        for (const device of devices) {
            device.schema = await this.getDeviceSchema(device.id);
        }
        // this.log.debug('Devices updated.\n', JSON.stringify(devices, null, 2));
        this.devices = devices;
        return devices;
    }
}
exports.default = TuyaCustomDeviceManager;
//# sourceMappingURL=TuyaCustomDeviceManager.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TuyaDevice_1 = __importDefault(require("./TuyaDevice"));
const TuyaDeviceManager_1 = __importDefault(require("./TuyaDeviceManager"));
class TuyaHomeDeviceManager extends TuyaDeviceManager_1.default {
    async getHomeList() {
        const res = await this.api.get(`/v1.0/users/${this.api.tokenInfo.uid}/homes`);
        return res;
    }
    async getHomeDeviceList(homeID) {
        const res = await this.api.get(`/v1.0/homes/${homeID}/devices`);
        return res;
    }
    async updateDevices(homeIDList) {
        let devices = [];
        for (const homeID of homeIDList) {
            const res = await this.getHomeDeviceList(homeID);
            devices = devices.concat(res.result.map(obj => new TuyaDevice_1.default(obj)));
        }
        if (devices.length === 0) {
            return [];
        }
        for (const device of devices) {
            device.schema = await this.getDeviceSchema(device.id);
        }
        // this.log.debug('Devices updated.\n', JSON.stringify(devices, null, 2));
        this.devices = devices;
        return devices;
    }
    async getSceneList(homeID) {
        const res = await this.api.get(`/v1.1/homes/${homeID}/scenes`);
        if (res.success === false) {
            this.log.warn('Get scene list failed. homeId = %d, code = %s, msg = %s', homeID, res.code, res.msg);
            return [];
        }
        const scenes = [];
        for (const { scene_id, name, enabled, status } of res.result) {
            if (enabled !== true || status !== '1') {
                continue;
            }
            scenes.push(new TuyaDevice_1.default({
                id: scene_id,
                uuid: scene_id,
                name,
                owner_id: homeID.toString(),
                product_id: 'scene',
                category: 'scene',
                schema: [],
                status: [],
                online: true,
            }));
        }
        return scenes;
    }
    async executeScene(homeID, sceneID) {
        const res = await this.api.post(`/v1.0/homes/${homeID}/scenes/${sceneID}/trigger`);
        return res;
    }
}
exports.default = TuyaHomeDeviceManager;
//# sourceMappingURL=TuyaHomeDeviceManager.js.map
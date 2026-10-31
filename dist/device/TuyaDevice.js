"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuyaDeviceSchemaType = exports.TuyaDeviceSchemaMode = void 0;
var TuyaDeviceSchemaMode;
(function (TuyaDeviceSchemaMode) {
    TuyaDeviceSchemaMode["UNKNOWN"] = "";
    TuyaDeviceSchemaMode["READ_WRITE"] = "rw";
    TuyaDeviceSchemaMode["READ_ONLY"] = "ro";
    TuyaDeviceSchemaMode["WRITE_ONLY"] = "wo";
})(TuyaDeviceSchemaMode = exports.TuyaDeviceSchemaMode || (exports.TuyaDeviceSchemaMode = {}));
var TuyaDeviceSchemaType;
(function (TuyaDeviceSchemaType) {
    TuyaDeviceSchemaType["Boolean"] = "Boolean";
    TuyaDeviceSchemaType["Integer"] = "Integer";
    TuyaDeviceSchemaType["Enum"] = "Enum";
    TuyaDeviceSchemaType["String"] = "String";
    TuyaDeviceSchemaType["Json"] = "Json";
    TuyaDeviceSchemaType["Raw"] = "Raw";
})(TuyaDeviceSchemaType = exports.TuyaDeviceSchemaType || (exports.TuyaDeviceSchemaType = {}));
class TuyaDevice {
    constructor(obj) {
        Object.assign(this, obj);
        this.status.sort((a, b) => a.code > b.code ? 1 : -1);
    }
    isVirtualDevice() {
        return this.id.startsWith('vdevo');
    }
    isIRControlHub() {
        return ['wnykq', 'hwktwkq', 'wsdykq']
            .includes(this.category);
    }
    isIRRemoteControl() {
        return this.remote_keys !== undefined || this.category.startsWith('infrared_');
    }
}
exports.default = TuyaDevice;
//# sourceMappingURL=TuyaDevice.js.map
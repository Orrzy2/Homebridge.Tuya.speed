import { describe, expect, test, jest } from '@jest/globals';
import * as hap from 'hap-nodejs';
import { PlatformAccessory } from 'homebridge/lib/platformAccessory';

import TuyaDevice, { TuyaDeviceSchemaMode, TuyaDeviceSchemaType } from '../src/device/TuyaDevice';
import TuyaDeviceManager from '../src/device/TuyaDeviceManager';
import AirPurifierAccessory, { getModeSpeedLevels } from '../src/accessory/AirPurifierAccessory';

const silentLog = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, log: () => {}, success: () => {} };

// Specification as returned by /v1.0/devices/{id}/specifications for HY4866-WF (reduced mode range).
const SPEC = {
  category: 'kj',
  functions: [
    { code: 'switch', type: 'Boolean', values: '{}' },
    { code: 'mode', type: 'Enum', values: '{"range":["auto","sleep"]}' },
    { code: 'lock', type: 'Boolean', values: '{}' },
  ],
  status: [
    { code: 'switch', type: 'Boolean', values: '{}' },
    { code: 'pm25', type: 'Integer', values: '{"unit":"ug/m3","min":0,"max":999,"scale":0,"step":1}' },
    { code: 'mode', type: 'Enum', values: '{"range":["auto","sleep"]}' },
    { code: 'lock', type: 'Boolean', values: '{}' },
    { code: 'air_quality', type: 'Enum', values: '{"range":["good"]}' },
  ],
};
const THING_MODEL = {
  services: [{
    properties: [
      { code: 'switch', typeSpec: { type: 'bool' } },
      { code: 'mode', typeSpec: { type: 'enum', range: ['auto', 'sleep', '1F', '2F', '3F', '4F'] } },
    ],
  }],
};

function makeApi(responses: Record<string, unknown>) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const respond = (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    for (const [pattern, res] of Object.entries(responses)) {
      if (path.includes(pattern)) {
        return Promise.resolve(typeof res === 'function' ? (res as (b: unknown) => unknown)(body) : res);
      }
    }
    return Promise.resolve({ success: false, code: 404, msg: 'not mocked' });
  };
  const api = {
    log: { log: silentLog },
    get: jest.fn((path: string) => respond('get', path)),
    post: jest.fn((path: string, body?: unknown) => respond('post', path, body)),
  };
  return { api, calls };
}

describe('getModeSpeedLevels()', () => {
  test('extracts sleep + numbered levels in order', () => {
    expect(getModeSpeedLevels(['auto', 'sleep', '1F', '2F', '3F', '4F'])).toEqual(['sleep', '1F', '2F', '3F', '4F']);
    expect(getModeSpeedLevels(['auto', '3F', '1F', '2F'])).toEqual(['1F', '2F', '3F']);
  });
  test('ignores ranges without the pattern', () => {
    expect(getModeSpeedLevels(['auto', 'sleep'])).toBeUndefined();
    expect(getModeSpeedLevels(['auto', 'manual', 'sleep'])).toBeUndefined();
    expect(getModeSpeedLevels(['auto', '1F'])).toBeUndefined();
    expect(getModeSpeedLevels(undefined)).toBeUndefined();
  });
});

describe('TuyaDeviceManager', () => {
  test('widens kj enum ranges from the thing model', async () => {
    const { api } = makeApi({
      '/specifications': { success: true, result: SPEC },
      '/model': { success: true, result: { model: JSON.stringify(THING_MODEL) } },
    });
    const dm = new TuyaDeviceManager(api as never);
    const schema = await dm.getDeviceSchema('dev1');
    const mode = schema.find(s => s.code === 'mode')!;
    expect(mode.mode).toBe(TuyaDeviceSchemaMode.READ_WRITE);
    expect((mode.property as { range: string[] }).range).toEqual(['auto', 'sleep', '1F', '2F', '3F', '4F']);
  });

  test('does not query the thing model for other categories', async () => {
    const { api, calls } = makeApi({
      '/specifications': { success: true, result: { ...SPEC, category: 'cz' } },
      '/model': { success: true, result: { model: JSON.stringify(THING_MODEL) } },
    });
    const dm = new TuyaDeviceManager(api as never);
    const schema = await dm.getDeviceSchema('dev1');
    expect((schema.find(s => s.code === 'mode')!.property as { range: string[] }).range).toEqual(['auto', 'sleep']);
    expect(calls.some(c => c.path.includes('/model'))).toBe(false);
  });

  test('keeps the spec schema when the thing model fails', async () => {
    const { api } = makeApi({
      '/specifications': { success: true, result: SPEC },
      '/model': { success: false, code: 1106, msg: 'permission deny' },
    });
    const dm = new TuyaDeviceManager(api as never);
    const schema = await dm.getDeviceSchema('dev1');
    expect((schema.find(s => s.code === 'mode')!.property as { range: string[] }).range).toEqual(['auto', 'sleep']);
  });

  test('retries via properties issue on 2008', async () => {
    const { api, calls } = makeApi({
      '/commands': { success: false, code: 2008, msg: 'command or value not support' },
      '/shadow/properties/issue': { success: true, result: {} },
    });
    const dm = new TuyaDeviceManager(api as never);
    const result = await dm.sendCommands('dev1', [{ code: 'mode', value: '3F' }]);
    expect(result).toEqual({});
    expect(calls.map(c => c.path)).toEqual([
      '/v1.0/devices/dev1/commands',
      '/v2.0/cloud/thing/dev1/shadow/properties/issue',
    ]);
    expect(calls[1].body).toEqual({ properties: JSON.stringify({ mode: '3F' }) });
  });

  test('no retry on success or other errors', async () => {
    for (const res of [{ success: true, result: true }, { success: false, code: 1106, msg: 'permission deny' }]) {
      const { api, calls } = makeApi({ '/commands': res });
      const dm = new TuyaDeviceManager(api as never);
      await dm.sendCommands('dev1', [{ code: 'switch', value: true }]);
      expect(calls.length).toBe(1);
    }
  });
});

describe('AirPurifierAccessory mode speed', () => {
  function setup(modeRange: string[], modeValue: string, extraSchema: TuyaDevice['schema'] = []) {
    const device = new TuyaDevice({
      id: 'dev1', uuid: 'uuid1', name: 'Purifier', online: true, product_id: 'p1', category: 'kj',
      status: [
        { code: 'switch', value: true }, { code: 'mode', value: modeValue },
        { code: 'lock', value: false }, { code: 'pm25', value: 11 }, { code: 'air_quality', value: 'good' },
        ...extraSchema.map(s => ({ code: s.code, value: 'low' })),
      ],
    } as never);
    device.schema = [
      { code: 'switch', mode: TuyaDeviceSchemaMode.READ_WRITE, type: TuyaDeviceSchemaType.Boolean, property: {} },
      { code: 'mode', mode: TuyaDeviceSchemaMode.READ_WRITE, type: TuyaDeviceSchemaType.Enum, property: { range: modeRange } },
      { code: 'lock', mode: TuyaDeviceSchemaMode.READ_WRITE, type: TuyaDeviceSchemaType.Boolean, property: {} },
      { code: 'pm25', mode: TuyaDeviceSchemaMode.READ_ONLY, type: TuyaDeviceSchemaType.Integer,
        property: { min: 0, max: 999, scale: 0, step: 1, unit: 'ug/m3' } },
      { code: 'air_quality', mode: TuyaDeviceSchemaMode.READ_ONLY, type: TuyaDeviceSchemaType.Enum, property: { range: ['good'] } },
      ...extraSchema,
    ] as never;
    const sent: unknown[] = [];
    const deviceManager = {
      getDevice: () => device,
      sendCommands: jest.fn(async (_id: string, commands: unknown[]) => {
        sent.push(...commands.map(c => ({ ...(c as object) })));
      }),
    };
    const platform = {
      api: { hap }, log: silentLog, options: {}, deviceManager,
      getDeviceConfig: () => undefined, getDeviceSchemaConfig: () => undefined,
    };
    const accessory = new PlatformAccessory('Purifier', hap.uuid.generate('dev1'));
    accessory.context.deviceID = 'dev1';
    const handler = new AirPurifierAccessory(platform as never, accessory as never);
    handler.configureServices();
    const service = accessory.getService(hap.Service.AirPurifier)!;
    return { device, service, accessory, sent, handler };
  }
  const flush = () => new Promise(resolve => setTimeout(resolve, 250));

  test('exposes RotationSpeed with sleep + 4 levels and maps values', async () => {
    const { service, sent } = setup(['auto', 'sleep', '1F', '2F', '3F', '4F'], '4F');
    const speed = service.getCharacteristic(hap.Characteristic.RotationSpeed);
    expect(speed.props.maxValue).toBe(5);
    expect(speed.props.minStep).toBe(1);
    expect(await speed.handleGetRequest()).toBe(5);

    await speed.handleSetRequest(3);
    await flush();
    expect(sent).toEqual([{ code: 'mode', value: '2F' }]);
    expect(await speed.handleGetRequest()).toBe(3);

    await speed.handleSetRequest(1);
    await flush();
    expect(sent[1]).toEqual({ code: 'mode', value: 'sleep' });
  });

  test('auto mode reads as speed 0 and target AUTO; MANUAL sends 1F', async () => {
    const { service, sent } = setup(['auto', 'sleep', '1F', '2F', '3F', '4F'], 'auto');
    const { AUTO, MANUAL } = hap.Characteristic.TargetAirPurifierState;
    const target = service.getCharacteristic(hap.Characteristic.TargetAirPurifierState);
    expect(await service.getCharacteristic(hap.Characteristic.RotationSpeed).handleGetRequest()).toBe(0);
    expect(await target.handleGetRequest()).toBe(AUTO);

    await target.handleSetRequest(MANUAL);
    await flush();
    expect(sent).toEqual([{ code: 'mode', value: '1F' }]);
    expect(await target.handleGetRequest()).toBe(MANUAL);

    await target.handleSetRequest(AUTO);
    await flush();
    expect(sent[1]).toEqual({ code: 'mode', value: 'auto' });
  });

  test('MANUAL keeps the current manual speed', async () => {
    const { service, sent } = setup(['auto', 'sleep', '1F', '2F', '3F', '4F'], '3F');
    await service.getCharacteristic(hap.Characteristic.TargetAirPurifierState)
      .handleSetRequest(hap.Characteristic.TargetAirPurifierState.MANUAL);
    await flush();
    expect(sent).toEqual([{ code: 'mode', value: '3F' }]);
  });

  test('upstream behaviour unchanged for auto/manual/sleep purifiers', async () => {
    const { service, sent } = setup(['auto', 'manual', 'sleep'], 'auto');
    expect(service.testCharacteristic(hap.Characteristic.RotationSpeed)).toBe(false);
    await service.getCharacteristic(hap.Characteristic.TargetAirPurifierState)
      .handleSetRequest(hap.Characteristic.TargetAirPurifierState.MANUAL);
    await flush();
    expect(sent).toEqual([{ code: 'mode', value: 'manual' }]);
  });

  test('a real fan_speed_enum DP still takes priority', async () => {
    const fanSpeed = { code: 'fan_speed_enum', mode: TuyaDeviceSchemaMode.READ_WRITE, type: TuyaDeviceSchemaType.Enum,
      property: { range: ['low', 'mid', 'high'] } };
    const { service } = setup(['auto', 'sleep', '1F', '2F', '3F', '4F'], 'auto', [fanSpeed as never]);
    expect(service.getCharacteristic(hap.Characteristic.RotationSpeed).props.maxValue).toBe(3);
  });

  test('PM2.5 / air quality sensor is exposed', () => {
    const { accessory } = setup(['auto', 'sleep', '1F', '2F', '3F', '4F'], '4F');
    const aq = accessory.getService(hap.Service.AirQualitySensor);
    expect(aq).toBeDefined();
    expect(aq!.testCharacteristic(hap.Characteristic.PM2_5Density)).toBe(true);
  });
});

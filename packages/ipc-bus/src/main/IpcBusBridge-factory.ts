import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../utils';

import { IpcBusBridge } from './IpcBusBridge';

const g_bridge_symbol_name = 'IpcBusBridge';

export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (): IpcBusBridge => {
    let g_bridge = IpcBusUtils.GetSingleton<IpcBusBridge>(g_bridge_symbol_name);
    // Beware, we test 'undefined' here
    if (g_bridge === undefined) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusBridge process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main': {
                const newModule = require('./IpcBusBridge-factory-main');
                g_bridge = newModule.NewIpcBusBridge(electronProcessType);
                break;
            }
            // not supported process
            case 'renderer':
            case 'node':
            default:
                g_bridge = null;
                break;
        }
        IpcBusUtils.RegisterSingleton(g_bridge_symbol_name, g_bridge);
    }
    return g_bridge;
};

IpcBusBridge.Create = CreateIpcBusBridge;
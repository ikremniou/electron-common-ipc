import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../utils';

import { IpcBusBroker } from './IpcBusBroker';

const g_broker_symbol_name = 'IpcBusBroker';

export const CreateIpcBusBroker: IpcBusBroker.CreateFunction = (): IpcBusBroker | null => {
    let g_broker = IpcBusUtils.GetSingleton<IpcBusBroker>(g_broker_symbol_name);
    // Beware, we test 'undefined' here
    if (g_broker === undefined) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main': {
                const newModule = require('./IpcBusBroker-factory-main');
                g_broker = newModule.NewIpcBusBroker(electronProcessType);
                break;
            }
            case 'node': {
                const newModule = require('./IpcBusBroker-factory-node');
                g_broker = newModule.NewIpcBusBroker(electronProcessType);
                break;
            }
            // not supported process
            case 'renderer':
            default:
                g_broker = null;
                break;
        }
        IpcBusUtils.RegisterSingleton(g_broker_symbol_name, g_broker);
    }
    return g_broker;
};

IpcBusBroker.Create = CreateIpcBusBroker;
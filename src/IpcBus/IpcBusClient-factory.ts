import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

export const CreateIpcBusClient: IpcBusClient.CreateFunction = (): IpcBusClient => {
    const electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${electronProcessType}`);
    let ipcBusClient: IpcBusClient = null;
    switch (electronProcessType) {
        // This case 'renderer' may not be reachable as 'factory-browser' is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer': {
            const newModule = require('./IpcBusClient-factory-renderer');
            ipcBusClient = newModule.NewIpcBusClient(electronProcessType);
            break;
        }
        case 'main': {
            const newModule = require('./IpcBusClient-factory-main');
            ipcBusClient = newModule.NewIpcBusClient(electronProcessType);
            break;
        }
        case 'node': {
            const newModule = require('./IpcBusClient-factory-node');
            ipcBusClient = newModule.NewIpcBusClient(electronProcessType);
            break;
        }
    }
    return ipcBusClient;
};

IpcBusClient.Create = CreateIpcBusClient;

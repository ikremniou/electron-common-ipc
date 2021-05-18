import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import type { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    let ipcBusLogConfig: IpcBusLogConfig;
    const electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusLog process type = ${electronProcessType}`);
    switch (electronProcessType) {
        case 'main': {
            const newModule = require('./IpcBusLog-new-main');
            ipcBusLogConfig = newModule.NewIpcBusLog();
            break;
        }
        // This case 'renderer' is not reachable as 'factory-browser' is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer': {
            const newModule = require('./IpcBusLog-new-renderer');
            ipcBusLogConfig = newModule.NewIpcBusLog();
            break;
        }
        case 'node':
        default: {
            const newModule = require('./IpcBusLog-new-node');
            ipcBusLogConfig = newModule.NewIpcBusLog();
            break;
        }
    }
    return ipcBusLogConfig;
};

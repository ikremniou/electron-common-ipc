import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../utils';

import type { IpcBusLogConfig } from './IpcBusLogConfig';

const g_log_symbol_name = 'IpcBusLogConfig';

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    let g_log = IpcBusUtils.GetSingleton<IpcBusLogConfig>(g_log_symbol_name);
    if (g_log == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusLog process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main': {
                const newModule = require('./IpcBusLog-new-main');
                g_log = newModule.NewIpcBusLog();
                break;
            }
            // This case 'renderer' is not reachable as 'factory-browser' is used in a browser (see browserify 'browser' field in package.json)
            case 'renderer': {
                const newModule = require('./IpcBusLog-new-renderer');
                g_log = newModule.NewIpcBusLog();
                break;
            }
            case 'node':
            default: {
                const newModule = require('./IpcBusLog-new-node');
                g_log = newModule.NewIpcBusLog();
                break;
            }
        }
        IpcBusUtils.RegisterSingleton(g_log_symbol_name, g_log);
    }
    return g_log;
};

import { GlobalContainer } from '@electron-common-ipc/universal';

import type { IpcBusLogConfig } from '@electron-common-ipc/universal';

/** @internal */
export function CreateIpcBusLogSingleton(logSymbolName: string, factory: () => IpcBusLogConfig): IpcBusLogConfig {
    const globalContainer = new GlobalContainer();
    let logInstance = globalContainer.getSingleton<IpcBusLogConfig>(logSymbolName);
    if (logInstance === undefined) {
        logInstance = factory();
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`Created logger with symbol: ${logSymbolName}`);
        globalContainer.registerSingleton(logSymbolName, logInstance);
    }
    return logInstance;
}

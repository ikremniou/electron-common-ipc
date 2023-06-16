import { ContractLogLevel, GlobalContainer } from '@electron-common-ipc/universal';

import { JSONLogger } from './IpcBusJSONLogger';
import { SetLogLevel } from './IpcBusLogConfig-main';

import type { IpcBusLogLogger } from './IpcBusLog';

const gJsonLoggerSymbolName = 'JSONLogger';
export function setLogLevelJSON(level: ContractLogLevel, filename: string, argContentLen?: number): void {
    if (level >= ContractLogLevel.None) {
        const globalContainer = new GlobalContainer();
        let gJsonLogger = globalContainer.getSingleton<IpcBusLogLogger>(gJsonLoggerSymbolName);
        if (gJsonLogger === undefined) {
            gJsonLogger = new JSONLogger(filename);
            globalContainer.registerSingleton(gJsonLoggerSymbolName, gJsonLogger);
            const cb = gJsonLogger.writeLog.bind(gJsonLogger);
            SetLogLevel(level, cb, argContentLen);
        }
    }
}

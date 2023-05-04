import { ContractLogLevel, GlobalContainer } from '@electron-common-ipc/universal';

import { CSVLogger } from './IpcBusCSVLogger';
import { SetLogLevel } from './IpcBusLogConfig-main';

import type { IpcBusLogLogger } from './IpcBusLog';

const gCsvLoggerSymbolName = 'CSVLogger';
export const setLogLevelCVS = (level: ContractLogLevel, filename: string, argContentLen?: number): void => {
    if (level >= ContractLogLevel.None) {
        const globalContainer = new GlobalContainer();
        let gCsvLogger = globalContainer.getSingleton<IpcBusLogLogger>(gCsvLoggerSymbolName);
        if (gCsvLogger === undefined) {
            gCsvLogger = new CSVLogger(filename);
            globalContainer.registerSingleton(gCsvLoggerSymbolName, gCsvLogger);
            const cb = gCsvLogger.writeLog.bind(gCsvLogger);
            SetLogLevel(level, cb, argContentLen);
        }
    }
};

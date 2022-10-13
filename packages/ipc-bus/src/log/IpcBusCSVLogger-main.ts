import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

import { GetSingleton, RegisterSingleton } from '../utils';

const g_cvslogger_symbol_name = 'CSVLogger';
IpcBusLog.SetLogLevelCVS = (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        const cvsloggerMod = require('./IpcBusCSVLogger');
        let g_cvsLogger = GetSingleton< IpcBusLog.Logger>(g_cvslogger_symbol_name);
        if (g_cvsLogger == null) {
            g_cvsLogger = new cvsloggerMod.CSVLogger(filename);
            RegisterSingleton(g_cvslogger_symbol_name, g_cvsLogger);
            const cb = g_cvsLogger.writeLog.bind(g_cvsLogger);
            IpcBusLog.SetLogLevel(level, cb, argContentLen);
        }
    }
}

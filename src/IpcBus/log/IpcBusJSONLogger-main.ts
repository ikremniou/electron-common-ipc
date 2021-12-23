import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

import { GetSingleton, RegisterSingleton } from '../IpcBusUtils';

const g_jsonlogger_symbol_name = 'JSONLogger';
IpcBusLog.SetLogLevelJSON = (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        const jsonloggerMod = require('./IpcBusJSONLogger');
        let g_jsonLogger = GetSingleton<IpcBusLog.Logger>(g_jsonlogger_symbol_name);
        if (g_jsonLogger == null) {
            g_jsonLogger = new jsonloggerMod.JSONLogger(filename);
            RegisterSingleton(g_jsonlogger_symbol_name, g_jsonLogger);
            const cb = g_jsonLogger.writeLog.bind(g_jsonLogger);
            IpcBusLog.SetLogLevel(level, cb, argContentLen);
        }
    }
}

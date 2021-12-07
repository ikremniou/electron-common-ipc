import * as path from 'path';
import * as fse from 'fs-extra';

// import CVS_stringify from 'csv-stringify';
import { stringify } from 'csv-stringify';

import { GetSingleton, RegisterSingleton } from '../IpcBusUtils';

import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { JSONLoggerBase, JSONLog } from './IpcBusJSONLogger';

/** @internal */
export class CSVLogger extends JSONLoggerBase {
    private _stringifyer: any; // CVS_stringify.Stringifier;

    constructor(filename: string) {
        super();

        fse.ensureDirSync(path.dirname(filename));
        try {
            fse.unlinkSync(filename);
        }
        catch (_) {}

        const options: any = {
            header: true,
            quoted: true,
            columns: [
                { key: 'timestamp', header: 'timestamp' },
                { key: 'id', header: 'id' },
                { key: 'order', header: 'order' },
                { key: 'channel', header: 'channel' },
                { key: 'kind', header: 'kind' },
                { key: 'peer_id', header: 'peer id' },
                { key: 'delay', header: 'delay' },
                { key: 'local', header: 'local' },
                { key: 'peer', header: 'peer' },
                { key: 'peer_related', header: 'peer related' },
                { key: 'request', header: 'request' },
                { key: 'payload', header: 'payload' },
                { key: 'arg0', header: 'arg0' },
                { key: 'arg1', header: 'arg1' },
                { key: 'arg2', header: 'arg2' },
                { key: 'arg3', header: 'arg3' },
                { key: 'arg4', header: 'arg4' },
                { key: 'arg5', header: 'arg5' }
            ]
        };

        this._stringifyer = stringify(options);
        this._stringifyer.pipe(fse.createWriteStream(filename, { highWaterMark: 1024 }));
    }

    override writeLog(jsonLog: JSONLog): void {
        const csvJsonLog = jsonLog as any;
        csvJsonLog.local = jsonLog.local ? 'local' : '';
        csvJsonLog.request = jsonLog.responseChannel ? `${jsonLog.responseChannel} => ${jsonLog.responseStatus}` : '';
        this._stringifyer.write(csvJsonLog);
    }
}

const g_cvslogger_symbol_name = 'CSVLogger';

IpcBusLog.SetLogLevelCVS = (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        let g_cvsLogger = GetSingleton<CSVLogger>(g_cvslogger_symbol_name);
        if (g_cvsLogger == null) {
            g_cvsLogger = new CSVLogger(filename);
            RegisterSingleton(g_cvslogger_symbol_name, g_cvsLogger);
            const cb = g_cvsLogger.addLog.bind(g_cvsLogger);
            IpcBusLog.SetLogLevel(level, cb, argContentLen);
        }
    }
}

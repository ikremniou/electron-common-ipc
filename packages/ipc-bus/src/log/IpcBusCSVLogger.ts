import * as path from 'path';
import * as fse from 'fs-extra';

// import CVS_stringify from 'csv-stringify';
import { stringify } from 'csv-stringify';

import type { IpcBusLog } from './IpcBusLog';

/** @internal */
export class CSVLogger implements IpcBusLog.Logger {
    private _stringifyer: any; // CVS_stringify.Stringifier;

    constructor(filename: string) {
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
                { key: 'kindStr', header: 'kind' },
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
                { key: 'arg5', header: 'arg5' },
                { key: 'arg6', header: 'arg6' }
            ]
        };

        this._stringifyer = stringify(options);
        this._stringifyer.pipe(fse.createWriteStream(filename, { highWaterMark: 1024 }));
    }

    writeLog(message: IpcBusLog.Message): void {
        const csvJsonLog = message as any;
        csvJsonLog.local = message.local ? 'local' : '';
        const args = message.args;
        if (args) {
            for (let i = 0, l = Math.min(args.length, 7); i < l; ++i) {
                csvJsonLog[`arg${i}`] = args[i];
            }
        }
        csvJsonLog.request = message.responseChannel ? `${message.responseChannel} => ${message.responseStatus}` : '';
        this._stringifyer.write(csvJsonLog);
    }
}


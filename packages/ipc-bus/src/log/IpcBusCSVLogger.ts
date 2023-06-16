import { stringify } from 'csv-stringify';
import { createWriteStream, unlinkSync } from 'fs';
import * as path from 'path';

import { ensureDirSync } from './IpcBusLogUtils';

import type { IpcBusLogLogger, IpcBusLogMessage } from './IpcBusLog';
import type { Stringifier } from 'csv-stringify';

/** @internal */
export class CSVLogger implements IpcBusLogLogger {
    private readonly _stringify: Stringifier;

    constructor(filename: string) {
        ensureDirSync(path.dirname(filename));
        try {
            unlinkSync(filename);
        } catch {
            /* empty */
        }

        const options: Record<string, unknown> = {
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
                { key: 'arg6', header: 'arg6' },
            ],
        };

        this._stringify = stringify(options);
        this._stringify.pipe(createWriteStream(filename, { highWaterMark: 1024 }));
    }

    writeLog(message: IpcBusLogMessage): void {
        const csvJsonLog = message as unknown as Record<string, unknown>;
        csvJsonLog.local = message.local ? 'local' : '';
        const args = message.args;
        if (args) {
            for (let i = 0, l = Math.min(args.length, 7); i < l; ++i) {
                csvJsonLog[`arg${i}`] = args[i];
            }
        }
        csvJsonLog.request = message.responseChannel ? `${message.responseChannel} => ${message.responseStatus}` : '';
        this._stringify.write(csvJsonLog);
    }
}

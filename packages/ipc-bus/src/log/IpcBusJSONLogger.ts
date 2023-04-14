import { unlinkSync } from 'fs';
import * as path from 'path';
import * as winston from 'winston';

import { ensureDirSync } from './IpcBusLogUtils';

import type { IpcBusLogLogger, IpcBusLogMessage } from './IpcBusLog';

/** @internal */
export class JSONLogger implements IpcBusLogLogger {
    private readonly _winstonLogger: winston.Logger;

    constructor(filename: string) {
        ensureDirSync(path.dirname(filename));
        try {
            unlinkSync(filename);
        } catch {
            /* empty */
        }

        this._winstonLogger = winston.createLogger({
            transports: [
                new winston.transports.File({
                    filename,
                }),
            ],
        });
    }

    writeLog(message: IpcBusLogMessage): void {
        this._winstonLogger.info(message.order.toString(), message);
    }
}

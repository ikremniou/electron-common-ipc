import * as path from 'path';
import * as fse from 'fs-extra';
import * as winston from 'winston';

import type { IpcBusLog } from './IpcBusLog';

/** @internal */
export class JSONLogger implements IpcBusLog.Logger {
    private _winstonLogger: winston.Logger;

    constructor(filename: string) {
        fse.ensureDirSync(path.dirname(filename));
        try {
            fse.unlinkSync(filename);
        }
        catch (_) {}

        this._winstonLogger = winston.createLogger({
            transports: [
                new (winston.transports.File)({
                    filename
                })
            ]
        });
    }

    writeLog(message: IpcBusLog.Message): void {
        this._winstonLogger.info(message.order.toString(), message);
    }
}
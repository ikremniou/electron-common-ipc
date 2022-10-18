import * as path from 'path';
import * as fse from 'fs-extra';

import type { Logger as WinstonLogger } from 'winston';

import type { IpcBusLog } from './IpcBusLog';

/** @internal */
export class JSONLogger implements IpcBusLog.Logger {
    private _winstonLogger: WinstonLogger;

    constructor(filename: string) {
        fse.ensureDirSync(path.dirname(filename));
        try {
            fse.unlinkSync(filename);
        }
        catch (_) {}

        const winston = require('winston');
        if (winston) {
            this._winstonLogger = winston.createLogger({
                transports: [
                    new (winston.transports.File)({
                        filename
                    })
                ]
            });
        }
    }

    writeLog(message: IpcBusLog.Message): void {
        this._winstonLogger.info(message.order.toString(), message);
    }
}
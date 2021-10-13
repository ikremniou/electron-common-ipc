import * as path from 'path';
import * as fse from 'fs-extra';
import * as winston from 'winston';

import type * as Client from '../IpcBusClient';
// import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export interface JSONLog {
    order: number,
    timestamp: number;
    channel?: string,
    id: string,
    kind: string,
    peer_id: string,
    peer: Client.IpcBusPeer,
    peer_related?: Client.IpcBusPeer,
    delay?: number,
    local?: boolean,
    payload?: number,
    responseChannel?: string;
    responseStatus?: string;
    arg0?: string,
    arg1?: string,
    arg2?: string,
    arg3?: string,
    arg4?: string,
    arg5?: string,
}

/** @internal */
export class JSONLoggerBase {
    constructor() {
    }

    addLog(message: IpcBusLog.Message): void {
        const jsonLog: JSONLog = {
            order: message.order,
            timestamp: message.timestamp,
            channel: message.channel,
            id: message.id,
            kind: IpcBusLog.KindToStr(message.kind),
            peer: message.peer,
            peer_related: message.related_peer,
            peer_id: message.peer.id,
            delay: message.delay,
            local: message.local
        };

        jsonLog.responseChannel = message.responseChannel;
        jsonLog.responseStatus = message.responseStatus;
        jsonLog.payload = message.payload;

        const args = message.args;
        if (args) {
            for (let i = 0, l = args.length; i < l; ++i) {
                (jsonLog as any)[`arg${i}`] = args[i];
            }
        }
        this.writeLog(jsonLog);
    }

    writeLog(jsonLog: JSONLog): void {
    }
}

/** @internal */
export class JSONLogger extends JSONLoggerBase {
    private _winstonLogger: winston.Logger;

    constructor(filename: string) {
        super();

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

    override writeLog(jsonLog: JSONLog): void {
        this._winstonLogger.info(jsonLog.order.toString(), jsonLog);
    }
}

let jsonLogger: JSONLogger;
IpcBusLog.SetLogLevelJSON = (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        if (jsonLogger == null) {
            jsonLogger = new JSONLogger(filename);
            const cb = jsonLogger.addLog.bind(jsonLogger);
            IpcBusLog.SetLogLevel(level, cb, argContentLen);
        }
    }
    else {
        jsonLogger = null;
    }
}

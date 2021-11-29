import { IpcPacketBuffer, IpcPacketBufferList } from 'socket-serializer';

import type { IpcBusMessage } from '../IpcBusCommand';
import type { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';

import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { CreateIpcBusLog } from './IpcBusLog-factory';
import { IpcBusCommand } from '../IpcBusCommand';
import { JSONParserV1 } from 'json-helpers';
import { CutData } from './IpcBusLogUtils';

/** @internal */
export interface IpcBusLogMain extends IpcBusLogConfig {
    getCallback(): IpcBusLog.Callback;
    setCallback(cb?: IpcBusLog.Callback): void;
    addLog(command: IpcBusMessage, args: any[], payload?: number): boolean;
    addLogRawContent(ipcMessage: IpcBusMessage, IpcBusRendererContent: IpcBusRendererContent): boolean;
    addLogPacket(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean;
}

/** @internal */
export class IpcBusLogConfigMain extends IpcBusLogConfigImpl implements IpcBusLogMain {
    private _cb: IpcBusLog.Callback;
    protected _order: number;

    constructor() {
        super();
        this._order = 0;
    }

    getCallback(): IpcBusLog.Callback {
        return this._cb;
    }

    setCallback(cb?: IpcBusLog.Callback): void {
        this._cb = cb;
    }

    private getArgs(args?: any[]): any[] {
        if (args == null) {
            return [];
        }
        // We want full data
        if (this._argMaxContentLen <= 0) {
            return args;
        }
        else {
            const managed_args = [];
            for (let i = 0, l = args.length; i < l; ++i) {
                managed_args.push(CutData(args[i], this._argMaxContentLen));
            }
            return managed_args;
        }
    }

    private buildMessage(ipcMessage: IpcBusMessage, args: any[], payload: number): IpcBusLog.Message | null {
        if (ipcMessage.stamp == null) {
            return null;
        }
        let needArgs = (this._level & IpcBusLogConfig.Level.Args) === IpcBusLogConfig.Level.Args;
        const local = ipcMessage.stamp.local || ipcMessage.stamp.response_local;
        const message: Partial<IpcBusLog.Message> = {
            id: ipcMessage.stamp.id,
            peer: ipcMessage.stamp.peer, 
            related_peer: ipcMessage.stamp.peer_received,
            local,
            payload,
            args: needArgs ? this.getArgs(args) : undefined
        };

        switch (ipcMessage.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                message.kind = ipcMessage.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                message.order = 0;
                message.timestamp = ipcMessage.stamp.timestamp - this._baseTime;
                message.delay = 0,

                message.channel = ipcMessage.channel;
                message.responseChannel = ipcMessage.request && ipcMessage.request.id;
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                message.kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
                message.order = 2;
                message.timestamp = ipcMessage.stamp.timestamp_response - this._baseTime;
                message.delay = ipcMessage.stamp.timestamp_response - ipcMessage.stamp.timestamp_received;

                message.channel = ipcMessage.request.channel;
                message.responseChannel = ipcMessage.request.id;
                message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                break;
            }
            case IpcBusCommand.Kind.LogRoundtrip: {
                if (ipcMessage.stamp.kind === IpcBusCommand.Kind.SendMessage) {
                    message.kind = ipcMessage.request ? IpcBusLog.Kind.GET_REQUEST : IpcBusLog.Kind.GET_MESSAGE;
                    message.order = 1;
                    message.timestamp = ipcMessage.stamp.timestamp_received - this._baseTime;
                    message.delay = ipcMessage.stamp.timestamp_received - ipcMessage.stamp.timestamp;

                    message.channel = ipcMessage.channel;
                    message.responseChannel = ipcMessage.request && ipcMessage.request.id;
                }
                 else if (ipcMessage.stamp.kind === IpcBusCommand.Kind.RequestResponse) {
                    message.kind = IpcBusLog.Kind.GET_REQUEST_RESPONSE;
                    message.order = 3;
                    message.timestamp = ipcMessage.stamp.timestamp_response_received - this._baseTime;
                    message.delay = ipcMessage.stamp.timestamp_response_received - ipcMessage.stamp.timestamp_response;

                    message.channel = ipcMessage.request.channel;
                    message.responseChannel = ipcMessage.request.id;
                    message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                }
                break;
            }
        }
        this._cb(message as IpcBusLog.Message);
        return message as IpcBusLog.Message;
    }

    addLog(ipcMessage: IpcBusMessage, args: any[], payload?: number): boolean {
        this.buildMessage(ipcMessage, args, payload);
        return (ipcMessage.kind !== IpcBusCommand.Kind.LogRoundtrip);
    }

    addLogRawContent(ipcMessage: IpcBusMessage, rawData: IpcBusRendererContent): boolean {
        const ipcPacketBufferCore = rawData.buffer ? new IpcPacketBuffer(rawData) : new IpcPacketBufferList(rawData);
        ipcPacketBufferCore.JSON = JSONParserV1;
        return this.addLog(ipcMessage, ipcPacketBufferCore.parseArrayLength() > 1 ? ipcPacketBufferCore.parseArrayAt(1) : null, ipcPacketBufferCore.buffer.length);
    }

    addLogPacket(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this.addLog(ipcMessage,  ipcPacketBuffer.parseArrayLength() > 1 ? ipcPacketBuffer.parseArrayAt(1) : null, ipcPacketBuffer.buffer.length);
    }
}

IpcBusLog.SetLogLevel = (level: IpcBusLogConfig.Level, cb: IpcBusLog.Callback, argContentLen?: number): void => {
    const logger = CreateIpcBusLog() as IpcBusLogMain;
    logger.level = level;
    logger.setCallback(cb);
    logger.argMaxContentLen = argContentLen;
}




import { IpcPacketBuffer, IpcPacketBufferList, IpcPacketBufferCore } from 'socket-serializer';

import type { IpcBusMessage } from '../IpcBusCommand';

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
    addLogRawContent(ipcMessage: IpcBusMessage, rawData: IpcPacketBufferCore.RawData): boolean;
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
        let kind: IpcBusLog.Kind;
        switch (ipcMessage.kind) {
            case IpcBusCommand.Kind.SendMessage:
                kind = ipcMessage.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                break;
            case IpcBusCommand.Kind.RequestResponse:
                kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
                break;
            case IpcBusCommand.Kind.LogRoundtrip:
                kind = ipcMessage.stamp.kind;
                break;
            default:
                 return null;
        }
        let needArgs = (this._level & IpcBusLogConfig.Level.Args) === IpcBusLogConfig.Level.Args;
        const local = ipcMessage.stamp.local || ipcMessage.stamp.response_local;
        const message: Partial<IpcBusLog.Message> = {
            kind,
            kindStr: IpcBusLog.KindToStr(kind),
            id: ipcMessage.stamp.id,
            peer: ipcMessage.stamp.peer,
            related_peer: ipcMessage.stamp.peer_received,
            local,
            payload,
            args: needArgs ? this.getArgs(args) : undefined
        };

        switch (message.kind) {
            case IpcBusLog.Kind.SEND_REQUEST:
            case IpcBusLog.Kind.SEND_MESSAGE: {
                message.order = 0;
                message.timestamp = ipcMessage.stamp.timestamp - this._baseTime;
                message.delay = 0,

                message.channel = ipcMessage.channel;
                message.responseChannel = ipcMessage.request && ipcMessage.request.id;
                break;
            }
            case IpcBusLog.Kind.GET_REQUEST:
            case IpcBusLog.Kind.GET_MESSAGE: {
                message.order = 1;
                message.timestamp = ipcMessage.stamp.timestamp_received - this._baseTime;
                message.delay = ipcMessage.stamp.timestamp_received - ipcMessage.stamp.timestamp;

                message.channel = ipcMessage.channel;
                message.responseChannel = ipcMessage.request && ipcMessage.request.id;
                break;
            }
            case IpcBusLog.Kind.SEND_REQUEST_RESPONSE: {
                message.order = 2;
                message.timestamp = ipcMessage.stamp.timestamp_response - this._baseTime;
                message.delay = ipcMessage.stamp.timestamp_response - ipcMessage.stamp.timestamp_received;

                message.channel = ipcMessage.request.channel;
                message.responseChannel = ipcMessage.request.id;
                message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                break;
            }
            case IpcBusLog.Kind.GET_REQUEST_RESPONSE: {
                message.order = 3;
                message.timestamp = ipcMessage.stamp.timestamp_response_received - this._baseTime;
                message.delay = ipcMessage.stamp.timestamp_response_received - ipcMessage.stamp.timestamp_response;

                message.channel = ipcMessage.request.channel;
                message.responseChannel = ipcMessage.request.id;
                message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                break;
            }
        }
        this._cb(message as IpcBusLog.Message);
        return message as IpcBusLog.Message;
    }

    private _addLog(ipcMessage: IpcBusMessage, args: any[], payload?: number): boolean {
        this.buildMessage(ipcMessage, args, payload);
        return (ipcMessage.kind !== IpcBusCommand.Kind.LogRoundtrip);
    }

    addLog(ipcMessage: IpcBusMessage, args: any[]): boolean {
        const packet = new IpcPacketBuffer();
        const packetSize = packet.bytelength(args);
        return this._addLog(ipcMessage, args, packetSize);
    }

    addLogRawContent(ipcMessage: IpcBusMessage, rawData: IpcPacketBufferCore.RawData): boolean {
        const ipcPacketBufferCore = rawData.buffer ? new IpcPacketBuffer(rawData) : new IpcPacketBufferList(rawData);
        ipcPacketBufferCore.JSON = JSONParserV1;
        return this._addLog(ipcMessage, ipcPacketBufferCore.parseArrayLength() > 1 ? ipcPacketBufferCore.parseArrayAt(1) : null, ipcPacketBufferCore.packetSize);
    }

    addLogPacket(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this._addLog(ipcMessage,  ipcPacketBuffer.parseArrayLength() > 1 ? ipcPacketBuffer.parseArrayAt(1) : null, ipcPacketBuffer.packetSize);
    }
}

IpcBusLog.SetLogLevel = (level: IpcBusLogConfig.Level, cb: IpcBusLog.Callback, argContentLen?: number): void => {
    const logger = CreateIpcBusLog() as IpcBusLogMain;
    logger.level = level;
    logger.setCallback(cb);
    logger.argMaxContentLen = argContentLen;
}




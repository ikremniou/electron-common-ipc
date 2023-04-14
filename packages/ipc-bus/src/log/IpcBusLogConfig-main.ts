import {
    IpcBusCommandKind,
    IpcBusLogConfigImpl,
    MessageLogKind,
    ContractLogLevel,
} from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';
import { IpcPacketBuffer, IpcPacketBufferList } from 'socket-serializer';

import { LogKindToStr } from './IpcBusLog';
import { CreateIpcBusLog } from './IpcBusLog-factory-main';
import { cutData } from './IpcBusLogUtils';

import type { IpcBusLogCallback, IpcBusLogMessage } from './IpcBusLog';
import type { IpcBusMessage, IpcBusLogConfig, IpcBusStampedMessage } from '@electron-common-ipc/universal';
import type { IpcPacketBufferCore } from 'socket-serializer';

/** @internal */
export interface IpcBusLogMain extends IpcBusLogConfig {
    getCallback(): IpcBusLogCallback;
    setCallback(cb?: IpcBusLogCallback): void;
    addLog(command: IpcBusMessage, args: unknown[], payload?: number): boolean;
    addLogRawContent(ipcMessage: IpcBusMessage, rawData: IpcPacketBufferCore.RawData): boolean;
    addLogPacket(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean;
}

/** @internal */
export class IpcBusLogConfigMain extends IpcBusLogConfigImpl implements IpcBusLogMain {
    private _cb: IpcBusLogCallback;
    protected _order: number;

    constructor() {
        super();
        this._order = 0;
    }

    getCallback(): IpcBusLogCallback {
        return this._cb;
    }

    setCallback(cb?: IpcBusLogCallback): void {
        this._cb = cb;
    }

    private getArgs(args?: unknown[]): unknown[] {
        if (args === undefined) {
            return [];
        }
        // We want full data
        if (this._argMaxContentLen <= 0) {
            return args;
        }

        const managedArgs = [];
        for (let i = 0, l = args.length; i < l; ++i) {
            managedArgs.push(cutData(args[i], this._argMaxContentLen));
        }
        return managedArgs;
    }

    private buildMessage(ipcMessage: IpcBusStampedMessage, args: unknown[], payload: number): IpcBusLogMessage {
        ipcMessage = ipcMessage as IpcBusStampedMessage;
        if (ipcMessage.stamp === undefined) {
            return null;
        }
        let kind: MessageLogKind;
        switch (ipcMessage.kind) {
            case IpcBusCommandKind.SendMessage:
                kind = ipcMessage.request ? MessageLogKind.SEND_REQUEST : MessageLogKind.SEND_MESSAGE;
                break;
            case IpcBusCommandKind.RequestResponse:
                kind = MessageLogKind.SEND_REQUEST_RESPONSE;
                break;
            case IpcBusCommandKind.LogRoundtrip:
                kind = ipcMessage.stamp.kind;
                break;
            default:
                return null;
        }
        const needArgs = (this._level & ContractLogLevel.Args) === ContractLogLevel.Args;
        const local = ipcMessage.stamp.local || ipcMessage.stamp.responseLocal;
        const message: Partial<IpcBusLogMessage> = {
            kind,
            kindStr: LogKindToStr(kind),
            id: ipcMessage.stamp.id,
            peer: ipcMessage.stamp.peer,
            relatedPeer: ipcMessage.stamp.peerReceived,
            local,
            payload,
            args: needArgs ? this.getArgs(args) : undefined,
        };

        switch (message.kind) {
            case MessageLogKind.SEND_REQUEST:
            case MessageLogKind.SEND_MESSAGE: {
                message.order = 0;
                message.timestamp = ipcMessage.stamp.timestamp - this._baseTime;
                (message.delay = 0), (message.channel = ipcMessage.channel);
                message.responseChannel = ipcMessage.request && ipcMessage.request.id;
                break;
            }
            case MessageLogKind.GET_REQUEST:
            case MessageLogKind.GET_MESSAGE: {
                message.order = 1;
                message.timestamp = ipcMessage.stamp.timestampReceived - this._baseTime;
                message.delay = ipcMessage.stamp.timestampReceived - ipcMessage.stamp.timestamp;

                message.channel = ipcMessage.channel;
                message.responseChannel = ipcMessage.request && ipcMessage.request.id;
                break;
            }
            case MessageLogKind.SEND_REQUEST_RESPONSE: {
                message.order = 2;
                message.timestamp = ipcMessage.stamp.timestampResponse - this._baseTime;
                message.delay = ipcMessage.stamp.timestampResponse - ipcMessage.stamp.timestampReceived;

                message.channel = ipcMessage.request.channel;
                message.responseChannel = ipcMessage.request.id;
                message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                break;
            }
            case MessageLogKind.GET_REQUEST_RESPONSE: {
                message.order = 3;
                message.timestamp = ipcMessage.stamp.timestampResponseReceived - this._baseTime;
                message.delay = ipcMessage.stamp.timestampResponseReceived - ipcMessage.stamp.timestampResponse;

                message.channel = ipcMessage.request.channel;
                message.responseChannel = ipcMessage.request.id;
                message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                break;
            }
        }
        this._cb(message as IpcBusLogMessage);
        return message as IpcBusLogMessage;
    }

    private _addLog(ipcMessage: IpcBusMessage, args: unknown[], payload?: number): boolean {
        this.buildMessage(ipcMessage, args, payload);
        return ipcMessage.kind !== IpcBusCommandKind.LogRoundtrip;
    }

    addLog(ipcMessage: IpcBusMessage, args: unknown[]): boolean {
        const packet = new IpcPacketBuffer();
        const packetSize = packet.bytelength(args);
        return this._addLog(ipcMessage, args, packetSize);
    }

    addLogRawContent(ipcMessage: IpcBusMessage, rawData: IpcPacketBufferCore.RawData): boolean {
        const ipcPacketBufferCore = rawData.buffer ? new IpcPacketBuffer(rawData) : new IpcPacketBufferList(rawData);
        ipcPacketBufferCore.JSON = JSONParserV1;
        return this._addLog(
            ipcMessage,
            ipcPacketBufferCore.parseArrayLength() > 1 ? ipcPacketBufferCore.parseArrayAt(1) : null,
            ipcPacketBufferCore.packetSize
        );
    }

    addLogPacket(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this._addLog(
            ipcMessage,
            ipcPacketBuffer.parseArrayLength() > 1 ? ipcPacketBuffer.parseArrayAt(1) : null,
            ipcPacketBuffer.packetSize
        );
    }
}

export const SetLogLevel = (level: ContractLogLevel, cb: IpcBusLogCallback, argContentLen?: number): void => {
    const logger = CreateIpcBusLog() as IpcBusLogMain;
    logger.level = level;
    logger.setCallback(cb);
    logger.argMaxContentLen = argContentLen;
};

import { IpcPacketBuffer, IpcPacketBufferList } from 'socket-serializer';

import type { IpcBusMessage } from '../IpcBusCommand';
import type { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';

import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';
import type { IpcBusLogConfig } from './IpcBusLogConfig';
import { CreateIpcBusLog } from './IpcBusLog-factory';
import { IpcBusCommand } from '../IpcBusCommand';
import { JSONParserV1 } from 'json-helpers';
// import { CutData } from './IpcBusLogUtils';

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

    // private getArgs(args?: any[]): any[] {
    //     if (args == null) {
    //         return [];
    //     }
    //     // We want full data
    //     if (this._argMaxContentLen <= 0) {
    //         return args;
    //     }
    //     else {
    //         const managed_args = [];
    //         for (let i = 0, l = args.length; i < l; ++i) {
    //             managed_args.push(CutData(args[i], this._argMaxContentLen));
    //         }
    //         return managed_args;
    //     }
    // }

    private buildMessage(ipcMessage: IpcBusMessage, args: any[], payload: number): IpcBusLog.Message | null {
        // let needArgs = false;
        let kind: IpcBusLog.Kind;     
        const local = ipcMessage.stamp.related_peer ?? ipcMessage.stamp.peer.id === ipcMessage.stamp.related_peer.id;
        const message: Partial<IpcBusLog.Message> = {
            kind,
            id: ipcMessage.stamp.id,
            peer: ipcMessage.stamp.peer, 
            related_peer: ipcMessage.stamp.related_peer,
            local,
            payload,
            // args: needArgs ? this.getArgs(args) : undefined
        };

        switch (ipcMessage.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                message.kind = ipcMessage.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                message.order = 0;
                message.timestamp = ipcMessage.stamp.timestamp - this._baseTime;
                message.delay = 0,

                message.channel = ipcMessage.channel;
                // needArgs = (this._level & IpcBusLogConfig.Level.SentArgs) === IpcBusLogConfig.Level.SentArgs;
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
                message.order = 2;
                message.timestamp = ipcMessage.stamp.response_sent_timestamp - this._baseTime;
                message.delay = ipcMessage.stamp.timestamp - ipcMessage.stamp.response_sent_timestamp;

                message.channel = ipcMessage.request.channel;
                message.responseChannel = ipcMessage.request.id;
                message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                // needArgs = (this._level & IpcBusLogConfig.Level.SentArgs) === IpcBusLogConfig.Level.SentArgs;
                break;
            }
            case IpcBusCommand.Kind.LogRoundtrip: {
                if (ipcMessage.stamp.kind === IpcBusCommand.Kind.SendMessage) {
                    kind = ipcMessage.request ? IpcBusLog.Kind.GET_REQUEST : IpcBusLog.Kind.GET_MESSAGE;
                    message.order = 1;
                    message.timestamp = ipcMessage.stamp.related_timestamp - this._baseTime;
                    message.delay = ipcMessage.stamp.related_timestamp - ipcMessage.stamp.timestamp;

                    message.channel = ipcMessage.request.channel;
                }
                 else if (ipcMessage.stamp.kind === IpcBusCommand.Kind.RequestResponse) {
                    if (ipcMessage.stamp.request_args) {
                        const newipcMessage: IpcBusMessage = {
                            kind: IpcBusCommand.Kind.SendMessage,
                            peer: ipcMessage.stamp.peer,
                            channel: ipcMessage.request.channel,
                            request: ipcMessage.request,
                            stamp: ipcMessage.stamp
                        };
                        this.buildMessage(newipcMessage, ipcMessage.stamp.request_args, 0)
                        newipcMessage.kind = IpcBusCommand.Kind.LogRoundtrip;
                        this.buildMessage(newipcMessage, ipcMessage.stamp.request_args, 0)
                    }
                    if (ipcMessage.stamp.request_response) {
                        const newipcMessage: IpcBusMessage = {
                            kind: IpcBusCommand.Kind.RequestResponse,
                            peer: ipcMessage.stamp.related_peer,
                            channel: ipcMessage.request.id,
                            request: ipcMessage.request,
                            stamp: ipcMessage.stamp
                        };
                        this.buildMessage(newipcMessage, ipcMessage.stamp.request_args, 0)
                    }
                    kind = IpcBusLog.Kind.GET_REQUEST_RESPONSE;
                    message.order = 3;
                    message.timestamp = ipcMessage.stamp.response_received_timestamp - this._baseTime;
                    message.delay = ipcMessage.stamp.timestamp - ipcMessage.stamp.response_received_timestamp;

                    message.channel = ipcMessage.request.channel;
                    message.responseChannel = ipcMessage.request.id;
                    message.responseStatus = ipcMessage.request.resolve ? 'resolved' : 'rejected';
                }
                // needArgs = (this._level & IpcBusLogConfig.Level.GetArgs) === IpcBusLogConfig.Level.GetArgs;
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
        return this.addLog(ipcMessage, ipcPacketBufferCore.parseArrayAt(1), ipcPacketBufferCore.buffer.length);
    }

    addLogPacket(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this.addLog(ipcMessage, ipcPacketBuffer.parseArrayAt(1), ipcPacketBuffer.buffer.length);
    }
}

IpcBusLog.SetLogLevel = (level: IpcBusLogConfig.Level, cb: IpcBusLog.Callback, argContentLen?: number): void => {
    const logger = CreateIpcBusLog() as IpcBusLogMain;
    logger.level = level;
    logger.setCallback(cb);
    logger.argMaxContentLen = argContentLen;
}




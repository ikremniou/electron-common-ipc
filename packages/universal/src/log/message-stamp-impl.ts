import { IpcBusCommandKind } from '../contract/ipc-bus-command';
import { MessageLogKind } from './message-stamp';

import type { ConnectorHandshake } from '../client/bus-connector';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';
import type { IpcBusLogConfig } from './ipc-bus-log-config';
import type { IpcBusStampedMessage } from './message-stamp';

export class MessageStampImpl {
    constructor(private readonly _log: IpcBusLogConfig, private _messageCount: number = 0) {}

    stampMessage(ipcMessage: IpcBusMessage, localPeer?: IpcBusPeer): void {
        const peer = localPeer || ipcMessage.peer;
        const timestamp = this._log.now;
        const id = `${ipcMessage.peer.id}.m${this._messageCount++}`;
        (ipcMessage as IpcBusStampedMessage).stamp = {
            local: false,
            id,
            kind: ipcMessage.request ? MessageLogKind.SEND_REQUEST : MessageLogKind.SEND_MESSAGE,
            timestamp,
            peer,
        };
    }

    stampResponse(response: IpcBusMessage, message?: IpcBusMessage): void {
        const ipcResponse = response as IpcBusStampedMessage;
        if (message) {
            ipcResponse.stamp = (message as IpcBusStampedMessage)?.stamp;
        }
        if (ipcResponse.stamp) {
            ipcResponse.stamp.timestampResponse = this._log.now;
            ipcResponse.stamp.kind = MessageLogKind.SEND_REQUEST_RESPONSE;
        }
    }

    ackMessage(message: IpcBusMessage, local: boolean, localPeer: IpcBusPeer): IpcBusStampedMessage {
        const timestamp = this._log.now;
        const ipcMessage = message as IpcBusStampedMessage;
        if (ipcMessage.stamp === null) {
            local = false;
            // const ipcMessageMissing = Object.assign({}, ipcMessage,
            // { kind: IpcBusCommand.Kind.LogRoundtrip, isRawData: false });
            this.stampMessage(ipcMessage);
            ipcMessage.stamp.timestamp = timestamp;
            // this.postLogRoundtrip(ipcMessage, args);
        }
        (ipcMessage.stamp.kind = ipcMessage.request ? MessageLogKind.GET_REQUEST : MessageLogKind.GET_MESSAGE),
            (ipcMessage.stamp.timestampReceived = timestamp);
        ipcMessage.stamp.local = local;
        ipcMessage.stamp.peerReceived = localPeer;
        const ipcMessageClone = Object.assign({}, ipcMessage, {
            kind: IpcBusCommandKind.LogRoundtrip,
            isRawData: false,
        });
        return ipcMessageClone;
    }

    ackResponse(message: IpcBusMessage, local: boolean, localPeer: IpcBusPeer): IpcBusStampedMessage {
        let timestamp = this._log.now;
        const ipcMessage = message as IpcBusStampedMessage;
        if (ipcMessage.stamp === undefined) {
            // ackMessage simulation
            local = false;

            // Who receives the response is who sent the request
            this.stampMessage(ipcMessage, localPeer);
            timestamp = ipcMessage.stamp.timestamp;

            ipcMessage.stamp.timestampReceived = timestamp;
            // Who sent the response is who received the request
            ipcMessage.stamp.peerReceived = ipcMessage.peer;

            this.stampResponse(ipcMessage);
            ipcMessage.stamp.timestampResponse = timestamp;
        }
        ipcMessage.stamp.kind = MessageLogKind.GET_REQUEST_RESPONSE;
        ipcMessage.stamp.timestampResponseReceived = timestamp;
        ipcMessage.stamp.responseLocal = local;
        const ipcMessageClone = Object.assign({}, ipcMessage, {
            kind: IpcBusCommandKind.LogRoundtrip,
            isRawData: false,
        });
        return ipcMessageClone;
    }
    
    markHandshake(handshake: ConnectorHandshake): void {
        if (handshake.logLevel === undefined) {
            handshake.logLevel = this._log.level;
        }
    }
}

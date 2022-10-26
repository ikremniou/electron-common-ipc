import type { ConnectorHandshake } from '../client/bus-connector';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';

export const enum MessageLogKind {
    SEND_MESSAGE,
    GET_MESSAGE,
    SEND_REQUEST,
    GET_REQUEST,
    SEND_REQUEST_RESPONSE,
    GET_REQUEST_RESPONSE,
    SEND_CLOSE_REQUEST,
    GET_CLOSE_REQUEST,
}

export interface IpcBusMessageStamp {
    // order 0
    id: string;
    kind: MessageLogKind;
    local: boolean;

    peer: IpcBusPeer;
    timestamp: number;

    // order 1
    peerReceived?: IpcBusPeer;
    timestampReceived?: number;

    // order 2
    timestampResponse?: number;

    // order 3
    responseLocal?: boolean;
    timestampResponseReceived?: number;
}

export interface IpcBusStampedMessage extends IpcBusMessage {
    stamp?: IpcBusMessageStamp;
}

export interface MessageStamp {
    markHandshake(handshake: ConnectorHandshake): void;
    stampMessage(message: IpcBusMessage, localPeer?: IpcBusPeer): void;
    stampResponse(response: IpcBusMessage, message?: IpcBusMessage): void;
    ackMessage(message: IpcBusMessage, local: boolean, localPeer: IpcBusPeer): IpcBusStampedMessage;
    ackResponse(message: IpcBusMessage, local: boolean, localPeer: IpcBusPeer): IpcBusStampedMessage;
}

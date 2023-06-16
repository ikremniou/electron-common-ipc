import { MessageLogKind } from '@electron-common-ipc/universal';

import type { IpcBusPeer } from '@electron-common-ipc/universal';

export function LogKindToStr(kind: MessageLogKind): string {
    switch (kind) {
        case MessageLogKind.SEND_MESSAGE:
            return 'SendMessage';
        case MessageLogKind.GET_MESSAGE:
            return 'GetMessage';
        case MessageLogKind.SEND_REQUEST:
            return 'SendRequest';
        case MessageLogKind.GET_REQUEST:
            return 'GetRequest';
        case MessageLogKind.SEND_REQUEST_RESPONSE:
            return 'SendRequestResponse';
        case MessageLogKind.GET_REQUEST_RESPONSE:
            return 'GetRequestResponse';
        case MessageLogKind.SEND_CLOSE_REQUEST:
            return 'SendCloseRequest';
        case MessageLogKind.GET_CLOSE_REQUEST:
            return 'GetCloseRequest';
        default:
            return 'Unknown';
    }
}

export interface IpcBusLogMessage {
    id: string;
    order: number;
    peer: IpcBusPeer;
    relatedPeer: IpcBusPeer;
    timestamp: number;
    delay: number;
    channel: string;
    kind: MessageLogKind;
    kindStr: string;
    responseChannel?: string;
    responseStatus?: 'resolved' | 'rejected' | 'cancelled';
    local?: boolean;
    payload?: number;
    args?: unknown[];
}

export interface IpcBusLogCallback {
    (message: IpcBusLogMessage): void;
}

export interface IpcBusLogLogger {
    writeLog: IpcBusLogCallback;
}

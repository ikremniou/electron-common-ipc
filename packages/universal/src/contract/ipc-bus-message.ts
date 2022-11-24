import type { IpcBusCommandBase } from './ipc-bus-command';
import type { IpcBusPeer, IpcBusTarget } from './ipc-bus-peer';

export interface MessageRequest {
    id: string;
    channel: string;
    resolve?: boolean;
}

export interface IpcBusMessage extends IpcBusCommandBase {
    channel: string;

    peer: IpcBusPeer;
    target?: IpcBusTarget;

    isRawData?: boolean;

    request?: MessageRequest;
}

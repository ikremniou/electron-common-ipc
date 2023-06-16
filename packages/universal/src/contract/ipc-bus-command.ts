import type { IpcBusPeer } from './ipc-bus-peer';

export const enum IpcBusCommandKind {
    // Command
    Handshake = 'HAN',
    Shutdown = 'SHT',

    AddChannelListener = 'LICA',
    RemoveChannelListener = 'LICR',
    RemoveChannelAllListeners = 'LICRA',
    RemoveListeners = 'LIR',

    LogRoundtrip = 'LOGRT',

    BridgeConnect = 'BICOO',
    BridgeClose = 'BICOC',
    BridgeAddChannelListener = 'BILICA',
    BridgeRemoveChannelListener = 'BILICR',

    QueryState = 'QUST',
    QueryStateResponse = 'QUSTR',

    // Message
    SendMessage = 'MES',
    RequestResponse = 'RQR',
}

export interface IpcBusCommandBase {
    kind: IpcBusCommandKind;
    channel?: string;
}

interface IpcBusCommand1 extends IpcBusCommandBase {
    peer?: never;
    peers: IpcBusPeer[];
    channels?: string[];
}

interface IpcBusCommand2 extends IpcBusCommandBase {
    peer: IpcBusPeer;
    peers?: never;
    channels?: string[];
}

export type IpcBusCommand = IpcBusCommand1 | IpcBusCommand2;

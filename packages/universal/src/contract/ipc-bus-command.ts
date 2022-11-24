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

export interface IpcBusCommand extends IpcBusCommandBase {
    peer?: IpcBusPeer;
    channels?: string[];
}

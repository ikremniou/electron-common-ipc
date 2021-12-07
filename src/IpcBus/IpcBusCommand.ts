import type { IpcBusPeer, IpcBusPeerProcess } from './IpcBusClient';
import type { IpcBusLog } from './log/IpcBusLog';

/** @internal */
export namespace IpcBusCommand {
    export const KindBridgePrefix = 'BI' as const;
    export const KindBrokerPrefix = 'BO' as const;
    
    /** @internal */
    export enum Kind {
        // Command
        Handshake                   = 'HAN',
        Shutdown                    = 'SHT',

        AddChannelListener          = 'LICA',
        RemoveChannelListener       = 'LICR',
        RemoveChannelAllListeners   = 'LICRA',
        RemoveListeners             = 'LIR',

        LogRoundtrip                = 'LOGRT',

        BridgeConnect               = 'BICOO',
        BridgeClose                 = 'BICOC',
        BridgeAddChannelListener    = 'BILICA',
        BridgeRemoveChannelListener = 'BILICR',

        QueryState = 'QUST',
        QueryStateResponse = 'QUSTR',

        // Message
        SendMessage                 = 'MES',
        RequestResponse             = 'RQR',
    };

    /** @internal */
    export interface Request {
        id: string;
        channel: string;
        resolve?: boolean;
    }

    /** @internal */
    export interface LogCommand {
        kind: IpcBusCommand.Kind;
        peer: IpcBusPeer;
        channel: string;
        channels?: string[];
        request?: IpcBusCommand.Request;
    }

    /** @internal */
    export interface Log {
        id: string;
        peer: IpcBusPeer;
        related_peer?: IpcBusPeer;
        kind: IpcBusCommand.Kind;
        timestamp: number;
        local?: boolean;
        command?: IpcBusCommand.LogCommand;
        previous?: Log;
    }
}

export interface IpcBusTarget extends IpcBusPeerProcess {
    peerid?: string;
}

export interface IpcBusMessageStamp {
    // order 0
    id: string;
    kind: IpcBusLog.Kind;
    local: boolean;

    peer: IpcBusPeer;
    timestamp: number;

    // order 1
    peer_received?: IpcBusPeer;
    timestamp_received?: number;

    // order 2
    timestamp_response?: number;

    // order 3
    response_local?: boolean;
    timestamp_response_received?: number;
}

export interface IpcBusCommandBase {
    kind: IpcBusCommand.Kind;
    channel?: string;
}

export interface IpcBusCommand extends IpcBusCommandBase {
    peer?: IpcBusPeerProcess;
    channels?: string[];
}

export interface IpcBusMessage extends IpcBusCommandBase {
    channel: string;

    peer: IpcBusPeer;
    target?: IpcBusTarget;

    rawData?: boolean;

    request?: IpcBusCommand.Request;
    stamp?: IpcBusMessageStamp;
}

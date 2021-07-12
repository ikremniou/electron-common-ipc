import type { IpcBusPeer, IpcBusPeerProcess } from './IpcBusClient';

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

        LogGetMessage               = 'LOGGET',
        LogLocalSendRequest         = 'LOGMES',
        LogLocalRequestResponse     = 'LOGRQR',

        BridgeConnect               = 'BICOO',
        BridgeClose                 = 'BICOC',
        BridgeAddChannelListener    = 'BILICA',
        BridgeRemoveChannelListener = 'BILICR',

        BrokerAddChannelListener    = 'BOICA',
        BrokerRemoveChannelListener = 'BOICR',

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
    log?: IpcBusCommand.Log;
}

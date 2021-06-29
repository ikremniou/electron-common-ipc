import type { IpcBusPeer, IpcBusProcess as IpcBusEndpoint } from './IpcBusClient';

/** @internal */
export namespace IpcBusCommand {
    export const KindBridgePrefix = 'BI' as const;
    export const KindBrokerPrefix = 'BO' as const;
    
    /** @internal */
    export enum Kind {
        Handshake                   = 'HAN',
        Shutdown                    = 'SHT',

        AddChannelListener          = 'LICA',
        RemoveChannelListener       = 'LICR',
        RemoveChannelAllListeners   = 'LICRA',
        RemoveListeners             = 'LIR',

        SendMessage                 = 'MES',
        RequestResponse             = 'RQR',
        RequestClose                = 'RQC',

        LogGetMessage               = 'LOGGET',
        LogLocalSendRequest         = 'LOGMES',
        LogLocalRequestResponse     = 'LOGRQR',

        BridgeConnect               = 'BICOO',
        BridgeClose                 = 'BICOC',
        BridgeAddChannelListener    = 'BILICA',
        BridgeRemoveChannelListener = 'BILICR',

        BrokerAddChannelListener    = 'BOICA',
        BrokerRemoveChannelListener = 'BOICR',
    };

    /** @internal */
    export interface Request {
        id: string;
        channel: string;
        resolve?: boolean;
        reject?: boolean;
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

export interface IpcBusTarget extends IpcBusEndpoint {
    peerid?: string;
}

/** @internal */
export interface IpcBusCommand {
    kind: IpcBusCommand.Kind;

    peer?: IpcBusPeer;
    target?: IpcBusTarget;

    channel: string;
    channels?: string[];
    request?: IpcBusCommand.Request;
    log?: IpcBusCommand.Log;
}

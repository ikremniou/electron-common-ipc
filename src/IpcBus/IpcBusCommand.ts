import type { IpcBusEndpoint, IpcBusPeer } from './IpcBusClient';

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

        // Message
        SendMessage                 = 'MES',
        RequestResponse             = 'RQR',
        RequestClose                = 'RQC',

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
        peer: IpcBusEndpoint;
        channel: string;
        channels?: string[];
        request?: IpcBusCommand.Request;
    }

    /** @internal */
    export interface Log {
        id: string;
        peer: IpcBusEndpoint;
        related_peer?: IpcBusEndpoint;
        kind: IpcBusCommand.Kind;
        timestamp: number;
        local?: boolean;
        command?: IpcBusCommand.LogCommand;
        previous?: Log;
    }
}

export interface IpcBusTarget extends Omit<IpcBusEndpoint, 'id'> {
    peerid?: string;
}

export interface IpcBusCommandBase {
    kind: IpcBusCommand.Kind;
}

export interface IpcBusCommand extends IpcBusCommandBase {
    endpoint?: IpcBusEndpoint;

    channel?: string;
    channels?: string[];
}

export interface IpcBusMessage extends IpcBusCommandBase {
    peer: IpcBusPeer;
    target?: IpcBusTarget;

    channel: string;
    request?: IpcBusCommand.Request;
    log?: IpcBusCommand.Log;
}

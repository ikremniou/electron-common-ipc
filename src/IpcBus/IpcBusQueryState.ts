import type * as Client from './IpcBusClient';

/** @internal */
export interface QueryStateChannel {
    name: string;
    refCount: number
}

/** @internal */
export interface QueryStateChannels {
    [key: string]: QueryStateChannel
}

/** @internal */
export interface QueryStatePeer {
    peer: Client.IpcBusPeer;
    channels: QueryStateChannels
}

/** @internal */
export interface QueryStatePeers {
    [key: string]: QueryStatePeer;
}

/** @internal */
export interface QueryStatePeerProcess {
    peer: Client.IpcBusPeerProcess;
    channels: QueryStateChannels
}

/** @internal */
export interface QueryStatePeerProcesses {
    [key: string]: QueryStatePeerProcess;
}



/** @internal */
export interface QueryStateBase {
    type: 'transport'
            | 'connector' | 'connector-renderer' | 'connector-socket' | 'connector-socket-bridge'
            | 'renderer-bridge'
            | 'broker-bridge' | 'broker'
}

/** @internal */
export interface QueryStateResponse {
    id: string;
    queryState: QueryStateBase
}

export interface QueryStateTransport extends QueryStateBase {
    peers: QueryStatePeers;
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStateConnector extends QueryStateTransport {
    process: Client.IpcBusPeerProcess;
}

/** @internal */
export interface QueryStateRendererBridge extends QueryStateBase {
    type: 'renderer-bridge',
    channels: QueryStateChannels;
    peers: QueryStatePeerProcesses;
}

/** @internal */
export interface QueryStateSocketBrige extends QueryStateConnector {
    type: 'connector-socket-bridge',
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStateBroker extends QueryStateBase {
    type: 'broker' | 'broker-bridge',
    channels: QueryStateChannels;
    peers: QueryStatePeerProcesses;
}

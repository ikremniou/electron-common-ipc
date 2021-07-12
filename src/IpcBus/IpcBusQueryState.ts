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
export interface QueryStateTransport {
    peers: QueryStatePeers;
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStateConnector extends QueryStateTransport {
    type: 'connector' | 'connector-renderer' | 'connector-socket' | 'connector-socket-bridge',
    process: Client.IpcBusPeerProcess;
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
export interface QueryStateRendererBrige {
    channels: QueryStateChannels
}

/** @internal */
export interface QueryStateSocketBrige extends QueryStateConnector {
    type: 'connector-socket-bridge',
}

/** @internal */
export interface QueryStateBrokerBrige {
    channels: QueryStateChannels
}

/** @internal */
export interface QueryStateBroker {
    origin: 'broker',
    channels: QueryStateChannels;
    peers: QueryStatePeerProcesses;
}

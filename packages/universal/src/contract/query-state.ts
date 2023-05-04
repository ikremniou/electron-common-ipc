import type { IpcBusPeer } from './ipc-bus-peer';

export interface QueryStateChannel {
    name: string;
    refCount: number;
}

export interface QueryStateChannels {
    [key: string]: QueryStateChannel;
}

export interface QueryStatePeer {
    peer: IpcBusPeer;
    channels: QueryStateChannels;
}

export interface QueryStatePeers {
    [key: string]: QueryStatePeer;
}

export interface QueryStateBase {
    type:
        | 'transport'
        | 'transport-socket-bridge'
        | 'connector'
        | 'connector-renderer'
        | 'connector-socket'
        | 'renderer-bridge'
        | 'connector-ws'
        | 'connector-browser-ws'
        | 'broker-bridge'
        | 'broker'
        | 'connector-ws-local'
        | 'connector-main';
    contextId: string;
}

export interface QueryStateResponse {
    id: string;
    queryState: QueryStateBase;
}

export interface QueryStateTransport extends QueryStateBase {
    type: 'transport' | 'transport-socket-bridge';
    peers: QueryStatePeers;
    channels: QueryStateChannels;
}

export interface QueryStateConnector extends QueryStateBase {
    type:
        | 'connector-socket'
        | 'connector-renderer'
        | 'connector-ws'
        | 'connector-browser-ws'
        | 'connector-ws-local'
        | 'connector-main';
    peer: IpcBusPeer;
}

export interface QueryStateBroker extends Omit<QueryStateBase, 'peer'> {
    type: 'broker';
    peers: QueryStatePeers;
    channels: QueryStateChannels;
}

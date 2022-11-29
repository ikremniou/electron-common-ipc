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

export interface QueryStatePeerProcess {
    peer: IpcBusPeer;
    channels: QueryStateChannels;
}

export interface QueryStatePeerProcesses {
    [key: string]: QueryStatePeerProcess;
}

export interface QueryStateBase {
    type: 'transport' | 'transport-socket-bridge'
            | 'connector' | 'connector-renderer' | 'connector-socket'
            | 'renderer-bridge' | 'connector-ws' | 'connector-browser-ws'
            | 'broker-bridge' | 'broker' | 'connector-ws-local';
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

export interface QueryStateSocketBridge extends QueryStateTransport {
    type: 'transport-socket-bridge';
}

export interface QueryStateConnector extends QueryStateBase {
    type: 'connector-socket' | 'connector-renderer' | 'connector-ws' | 'connector-browser-ws' | 'connector-ws-local';
    peer: IpcBusPeer;
}

export interface QueryStateBridge extends QueryStateBase {
    peers: QueryStatePeerProcesses;
    channels: QueryStateChannels;
}

export interface QueryStateRendererBridge extends QueryStateBridge {
    type: 'renderer-bridge';
}

export interface QueryStateBroker extends Omit<QueryStateBridge, 'peer'> {
    type: 'broker' | 'broker-bridge';
}

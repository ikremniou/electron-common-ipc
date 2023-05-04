import type { IpcBusProcess, IpcBusProcessPeer } from '../client/IpcBusClient';
import type {
    QueryStateBase,
    QueryStateChannels,
    QueryStateTransport,
} from '@electron-common-ipc/universal';

/** @internal */
export interface QueryStatePeerProcess {
    peer: IpcBusProcessPeer;
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStatePeerProcesses {
    [key: string]: QueryStatePeerProcess;
}

/** @internal */
export interface QueryStateSocketBridge extends QueryStateTransport {
    type: 'transport-socket-bridge';
    process: IpcBusProcess;
}

/** @internal */
export interface QueryStateBridge extends QueryStateBase {
    peers: QueryStatePeerProcesses;
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStateRendererBridge extends QueryStateBridge {
    type: 'renderer-bridge';
}

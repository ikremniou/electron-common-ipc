import type { IpcBusRendererPeer } from '../main/IpcBusRendererBridge';
import type {
    IpcBusProcess,
    QueryStateBase,
    QueryStateChannels,
    QueryStateTransport,
} from '@electron-common-ipc/universal';

/** @internal */
export interface QueryStateRendererPeer {
    peer: IpcBusRendererPeer;
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStatePeerProcesses {
    [key: string]: QueryStateRendererPeer;
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

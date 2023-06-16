import { createIpcBusClient as CreateIpcBusClient } from './client/IpcBusClient-factory';
import { newIpcBusBridge as CreateIpcBusBridge } from './main/IpcBusBridge-factory';
import { newIpcBusBroker as CreateIpcBusBroker } from './node/IpcBusBroker-factory';

export type {
    IpcBusBridge,
    BridgeCloseFunction,
    BridgeCloseOptions,
    BridgeConnectFunction,
    BridgeConnectOptions,
} from './main/IpcBusBridge';

export * from './common';
export * from '@electron-common-ipc/universal/lib/public';
export { CreateIpcBusClient, CreateIpcBusBridge, CreateIpcBusBroker };

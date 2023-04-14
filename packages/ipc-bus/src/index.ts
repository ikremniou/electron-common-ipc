import { createIpcBusClient } from './client/IpcBusClient-factory';
import { newIpcBusBridge } from './main/IpcBusBridge-factory';
import { newIpcBusBroker } from './node/IpcBusBroker-factory';
import { createIpcBusService, createIpcBusServiceProxy } from './service/IpcBusService-factory';
import { activateIpcBusTrace } from './utils';

export type {
    IpcBusBridge,
    BridgeCloseFunction,
    BridgeCloseOptions,
    BridgeConnectFunction,
    BridgeConnectOptions,
} from './main/IpcBusBridge';

export * from '@electron-common-ipc/universal/lib/public';

export const CreateIpcBusService = createIpcBusService;
export const CreateIpcBusServiceProxy = createIpcBusServiceProxy;
export const ActivateIpcBusTrace = activateIpcBusTrace;
export const CreateIpcBusClient = createIpcBusClient;
export const CreateIpcBusBridge = newIpcBusBridge;
export const CreateIpcBusBroker = newIpcBusBroker;

import { createIpcBusClient } from './client/IpcBusClient-factory';
import { newIpcBusBridge } from './main/IpcBusBridge-factory';
import { newIpcBusBroker } from './node/IpcBusBroker-factory';
import { newIpcBusService, newIpcBusServiceProxy } from './service/IpcBusService-factory';
import { activateIpcBusTrace } from './utils/log';

export type {
    IpcBusBridge,
    BridgeCloseFunction,
    BridgeCloseOptions,
    BridgeConnectFunction,
    BridgeConnectOptions,
} from './main/IpcBusBridge';

export * from '@electron-common-ipc/universal/lib/public';

export const CreateIpcBusService = newIpcBusService;
export const CreateIpcBusServiceProxy = newIpcBusServiceProxy;
export const ActivateIpcBusTrace = activateIpcBusTrace;
export const CreateIpcBusClient = createIpcBusClient;
export const CreateIpcBusBridge = newIpcBusBridge;
export const CreateIpcBusBroker = newIpcBusBroker;

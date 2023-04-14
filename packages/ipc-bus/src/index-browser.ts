import { newIpcBusClient as CreateIpcBusClient } from './client/IpcBusClient-factory-renderer';

import type {
    createIpcBusService as CreateIpcBusService,
    createIpcBusServiceProxy as CreateIpcBusServiceProxy,
} from './service/IpcBusService-factory';
import type { IpcBusClient } from '@electron-common-ipc/universal';

declare global {
    interface Window {
        ElectronCommonIpc: {
            CreateIpcBusClient: () => IpcBusClient;
            CreateIpcBusService: typeof CreateIpcBusService;
            CreateIpcBusServiceProxy: typeof CreateIpcBusServiceProxy;
        };
    }
}

export * from '@electron-common-ipc/universal/lib/public';

export { CreateIpcBusClient, CreateIpcBusService, CreateIpcBusServiceProxy };

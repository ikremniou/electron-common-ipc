import { newIpcBusClient as CreateIpcBusClient } from './client/IpcBusClient-factory-renderer';
import {
    newIpcBusService as CreateIpcBusService,
    newIpcBusServiceProxy as CreateIpcBusServiceProxy,
} from './service/IpcBusService-factory';
import { activateIpcBusTrace as ActivateIpcBusTrace, activateServiceTrace as ActivateServiceTrace } from './utils/log';

import type { IpcBusClient } from '@electron-common-ipc/universal';

declare global {
    interface Window {
        ElectronCommonIpc: {
            CreateIpcBusClient: () => IpcBusClient;
        };
    }
}

export * from '@electron-common-ipc/universal/lib/public';

export { ActivateIpcBusTrace, CreateIpcBusClient, CreateIpcBusService, CreateIpcBusServiceProxy, ActivateServiceTrace };

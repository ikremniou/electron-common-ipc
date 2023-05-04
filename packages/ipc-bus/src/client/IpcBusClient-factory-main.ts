import { createIpcBusClient } from '../main/IpcBusClientMain-factory';

import type { IpcBusClient } from '@electron-common-ipc/universal';

/** @internal */
export function newIpcBusClient(): IpcBusClient {
    return createIpcBusClient();
}

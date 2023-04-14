import { ElectronCommonIpcNamespace } from '../renderer/IpcBusWindowNamespace';

import type { IpcBusClient } from '@electron-common-ipc/universal';


/** @internal */
export function newIpcBusClient(): IpcBusClient {
    const electronCommonIpcSpace = window[ElectronCommonIpcNamespace];
    if (electronCommonIpcSpace && electronCommonIpcSpace.CreateIpcBusClient) {
        return electronCommonIpcSpace.CreateIpcBusClient();
    }
    return undefined;
}

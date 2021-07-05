import type { IpcBusClient } from './IpcBusClient';
import type { ElectronProcessType } from 'electron-process-type/lib/v2';
import { ElectronCommonIpcNamespace, PreloadElectronCommonIpcAutomatic } from './renderer/IpcBusRendererPreload';

const windowLocal = window as any;
/** @internal */
export function NewIpcBusClient(electronProcessType: ElectronProcessType): IpcBusClient {
    const electronCommonIpcSpace = windowLocal[ElectronCommonIpcNamespace];
    if (electronCommonIpcSpace && electronCommonIpcSpace.CreateIpcBusClient) {
        return electronCommonIpcSpace.CreateIpcBusClient();
    }
    return null;
};

PreloadElectronCommonIpcAutomatic();
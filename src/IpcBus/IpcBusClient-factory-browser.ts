import { IpcBusClient } from './IpcBusClient';
import { ElectronCommonIpcNamespace, PreloadElectronCommonIpcAutomatic } from './renderer/IpcBusRendererPreload';

const windowLocal = window as any;
export const CreateIpcBusClient: IpcBusClient.CreateFunction = () => {
    const electronCommonIpcSpace = windowLocal[ElectronCommonIpcNamespace];
    if (electronCommonIpcSpace && electronCommonIpcSpace.CreateIpcBusClient) {
        return electronCommonIpcSpace.CreateIpcBusClient();
    }
    return null;
}

windowLocal.CreateIpcBusClient = CreateIpcBusClient;
IpcBusClient.Create = CreateIpcBusClient;

PreloadElectronCommonIpcAutomatic();
import { IpcBusClient } from './IpcBusClient';
import { ElectronCommonIPCNamespace } from './renderer/IpcBusRendererPreload';

const windowLocal = window as any;
export const CreateIpcBusClient: IpcBusClient.CreateFunction = () => {
    const electronCommonIPCSpace = windowLocal[ElectronCommonIPCNamespace];
    if (electronCommonIPCSpace && electronCommonIPCSpace.CreateIpcBusClient) {
        return electronCommonIPCSpace.CreateIpcBusClient();
    }
    return null;
}

windowLocal.CreateIpcBusClient = CreateIpcBusClient;
IpcBusClient.Create = CreateIpcBusClient;

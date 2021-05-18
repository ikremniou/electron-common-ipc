import { IpcBusClient } from './IpcBusClient';

export const CreateIpcBusClient: IpcBusClient.CreateFunction = () => {
    const newModule = require('./IpcBusClient-new-renderer');
    return newModule.NewIpcBusClient('renderer');
}

const windowLocal = window as any;
windowLocal.CreateIpcBusClient = CreateIpcBusClient;
IpcBusClient.Create = CreateIpcBusClient;
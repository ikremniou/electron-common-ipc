import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import { newIpcBusClient as newIpcBusClientMain } from './IpcBusClient-factory-main';
import { newIpcBusClient as newIpcBusClientNode } from './IpcBusClient-factory-node';
import { newIpcBusClient as newIpcBusClientRenderer } from './IpcBusClient-factory-renderer';

import type { IpcBusClient } from '@electron-common-ipc/universal';

let createClient: () => IpcBusClient;
const processType = GetElectronProcessType();
if (processType === 'main') {
    createClient = newIpcBusClientMain;
} else if (processType === 'node') {
    createClient = newIpcBusClientNode;
} else if (processType === 'renderer') {
    createClient = newIpcBusClientRenderer;
}


export const createIpcBusClient = createClient;

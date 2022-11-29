import { GlobalContainer } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

import { createWebSocketClient as createThin } from './ws-browser-factory-thin';

import type { IpcBusClient } from '@electron-common-ipc/universal';

const BrowserTransportToken = 'WsBrowserTransportToken';
export function createWebSocketClient(): IpcBusClient {
    const container = new GlobalContainer();
    const uuidProvider = () => nanoid();

    return createThin({
        uuidProvider,
        emitter: new EventEmitter(),
        container: {
            instance: container,
            transportSymbol: BrowserTransportToken,
        },
    });
}

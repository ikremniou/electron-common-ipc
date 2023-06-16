import { createWebSocketBroker } from '@electron-common-ipc/web-socket';

import type { IpcBusBrokerProxy } from './broker-proxy';

export async function wsLocalBrokerFactory(port: number): Promise<IpcBusBrokerProxy> {
    const localBroker = createWebSocketBroker();
    await localBroker.connect(port);
    return localBroker;
}

import { createWebSocketBrokerThin, DefaultContainer } from '@electron-common-ipc/web-socket';

import type { IpcBusBrokerProxy } from './broker-proxy';

export async function wsiLocalBrokerFactory(port: number): Promise<IpcBusBrokerProxy> {
    const localBroker = createWebSocketBrokerThin({
        json: JSON,
        container: new DefaultContainer(),
    });
    await localBroker.connect(port);
    return localBroker;
}

import { CreateIpcBusBroker } from 'electron-common-ipc';

import type { IpcBusBrokerProxy } from './broker-proxy';

export async function eipcLocalBrokerFactory(port: number): Promise<IpcBusBrokerProxy> {
    const localBroker = CreateIpcBusBroker();
    await localBroker.connect(port);
    return localBroker;
}

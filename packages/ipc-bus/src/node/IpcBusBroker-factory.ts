import { ConsoleLogger, GlobalContainer } from '@electron-common-ipc/universal';

import { IpcBusBrokerNode } from './IpcBusBrokerNode';
import { NetBrokerServerFactory } from './NetBrokerServerFactory';
import { Logger } from '../utils';

import type { IpcBusBroker } from '@electron-common-ipc/universal';

const gBrokerSymbolName = 'IpcBusBroker';
function createIpcBusBrokerSingleton(factory: () => IpcBusBroker): IpcBusBroker {
    const container = new GlobalContainer();
    let broker = container.getSingleton<IpcBusBroker>(gBrokerSymbolName);
    if (broker === undefined) {
        broker = factory();
        container.registerSingleton(gBrokerSymbolName, broker);
    }

    return broker;
}

export function newIpcBusBroker(): IpcBusBroker {
    const logger = Logger.enable ? new ConsoleLogger() : undefined;
    return createIpcBusBrokerSingleton(() => new IpcBusBrokerNode(new NetBrokerServerFactory(logger)));
}

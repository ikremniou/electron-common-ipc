import { ConsoleLogger, GlobalContainer } from '@electron-common-ipc/universal';

import { IpcBusBrokerNode } from './IpcBusBrokerNode';
import { NetBrokerServerFactory } from './NetBrokerServerFactory';
import { Logger } from '../utils/log';

import type { IpcBusBroker } from '@electron-common-ipc/universal';

const gBrokerSymbolName = 'IpcBusBroker';
export function newIpcBusBroker(): IpcBusBroker {
    const container = new GlobalContainer();
    let broker = container.getSingleton<IpcBusBroker>(gBrokerSymbolName);
    if (broker === undefined) {
        const logger = Logger.enable ? new ConsoleLogger() : undefined;
        broker = new IpcBusBrokerNode(new NetBrokerServerFactory(logger), logger);
        container.registerSingleton(gBrokerSymbolName, broker);
    }

    return broker;
}


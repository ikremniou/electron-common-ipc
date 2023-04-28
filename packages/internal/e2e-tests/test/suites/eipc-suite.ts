import { findFirstFreePort } from 'socket-port-helpers';

import type { BasicSmokeContext } from './smoke-suite';
import type { IpcBusBrokerProxy } from '../clients/broker/broker-proxy';
import type { ClientHost } from '../clients/echo-contract';
import type { IpcBusClient } from 'electron-common-ipc';

export interface EipcContext extends BasicSmokeContext {
    /**
     * Create Node process instance and activates Ipc client on it.
     * @param port The port Net client will connect to
     */
    createNodeHost(port: number): Promise<ClientHost>;
}

export function shouldRunEipcSpecificTests(suiteId: string, ctx: EipcContext) {
    describe(`[${suiteId}] should exchange messages between node and renderer`, () => {
        let localMainClient: IpcBusClient;
        let brokerAndBridge: IpcBusBrokerProxy;
        let nodeHost: ClientHost;
        let rendererHost: ClientHost;

        before(async () => {
            const port = await findFirstFreePort({ testConnection: true, testDataTransfer: true });
            brokerAndBridge = await ctx.createBroker(port);
            localMainClient = ctx.createBusClient();
            await localMainClient.connect(port);

            nodeHost = await ctx.createNodeHost(port);
            rendererHost = await ctx.startClientHost(port);
        });

        after(async () => {});

        it('should send message from node process to renderer process', () => {});

        it('should send message from renderer process to node process', () => {});

        it('should create service on node process and proxy on renderer process and communicate', () => {});

        it('should create service on renderer process and proxy on node process and communicate', () => {});

        it('should send message from main client(local) to node process', () => {});

        it('should send message from main client(local) to renderer process', () => {});

        it('should able to communicate node-to-node when bridge is connected', () => {});
    });

    describe(`[${suiteId}] should perform service utilities`, () => {
        it('should send query state from the main process and receive information about all pears', () => {});

        it('should send query state from the main process and get subscribed channel from the renderer bridge', () => {
            // go
        });

        it('should send query state from the main process and find the subscribed channel in the node broker', () => {
            // go
        });

        it('should send query state and get the transport information back', () => {});

        it('should send query state and get the connector information back', () => {});

        // check message stamp?
    });
}

import { expect } from 'chai';
import { ActivateIpcBusTrace } from 'electron-common-ipc';
import { findFirstFreePort } from 'socket-port-helpers';

import type { BasicSmokeContext } from './smoke-suite';
import type { IpcBusBrokerProxy } from '../clients/broker/broker-proxy';
import type { ClientHost, ClientSubscribeReport, ProxyCounterConfirm } from '../clients/echo-contract';
import type { IpcBusClient } from 'electron-common-ipc';

ActivateIpcBusTrace(true);

export interface EipcContext extends BasicSmokeContext {
    /**
     * Create Node process instance and activates Ipc client on it.
     * @param port The port Net client will connect to
     */
    startClientHostNode(port: number): Promise<ClientHost>;
}

export function shouldRunEipcSpecificTests(suiteId: string, ctx: EipcContext) {
    const sampleEipcObject = {
        prop1: '1',
        prop2: 2,
        array: [1, 2, 3, 4, '5', null],
    };

    async function waitForChannels() {
        // TODO: we wait because the bridge might not have a channel yet. Can we broadcast?
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

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

            nodeHost = await ctx.startClientHostNode(port);
            rendererHost = await ctx.startClientHost(port);
        });

        after(async () => {
            nodeHost.close();
            rendererHost.close();
            await localMainClient.close();
            await brokerAndBridge.close();
        });

        it('should send message from node process to renderer process', async () => {
            rendererHost.sendCommand({
                type: 'subscribe-report',
                channel: 'test-channel-1',
            });
            await rendererHost.waitForMessage('done');

            nodeHost.sendCommand({
                type: 'send',
                channel: 'test-channel-1',
                data: sampleEipcObject,
            });

            const result = await Promise.all([
                nodeHost.waitForMessage('done'),
                rendererHost.waitForMessage('client-subscribe-report'),
            ]);

            const report = result[1] as ClientSubscribeReport;
            expect(report.data).to.be.deep.eq(sampleEipcObject);
            expect(report.event.channel).to.be.eq('test-channel-1');
        });

        it('should send message from renderer process to node process', async () => {
            nodeHost.sendCommand({
                type: 'subscribe-report',
                channel: 'test-channel-2',
            });
            await nodeHost.waitForMessage('done');

            await waitForChannels();

            rendererHost.sendCommand({
                type: 'send',
                channel: 'test-channel-2',
                data: sampleEipcObject,
            });

            const result = await Promise.all([
                rendererHost.waitForMessage('done'),
                nodeHost.waitForMessage('client-subscribe-report'),
            ]);

            const report = result[1] as ClientSubscribeReport;
            expect(report.data).to.be.deep.eq(sampleEipcObject);
            expect(report.event.channel).to.be.eq('test-channel-2');
        });

        it('should create service on node process and proxy on renderer process and communicate', async () => {
            nodeHost.sendCommand({
                type: 'start-echo-service',
                channel: 'some-service',
            });
            await nodeHost.waitForMessage('done');

            await waitForChannels();

            rendererHost.sendCommand({
                type: 'start-echo-service-proxy',
                channel: 'some-service',
                counterEvents: [[3, 'some-event']],
            });
            await rendererHost.waitForMessage('done');

            nodeHost.sendCommand({
                type: 'emit-echo-service-event',
                channel: 'some-service',
                data: sampleEipcObject,
                times: 3,
            });
            const result = await Promise.all([
                nodeHost.waitForMessage('done'),
                rendererHost.waitForMessage('counter-confirm'),
            ]);
            const counterConfirm = result[1] as ProxyCounterConfirm;
            expect(counterConfirm.lastEventData).to.be.deep.eq(sampleEipcObject);

            rendererHost.sendCommand({
                type: 'stop-echo-service-proxy',
                channel: 'some-service',
            });
            await rendererHost.waitForMessage('done');
            nodeHost.sendCommand({
                type: 'stop-echo-service',
                channel: 'some-service',
            });
            await nodeHost.waitForMessage('done');
        });

        it('should create service on renderer process and proxy on node process and communicate', async () => {});

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

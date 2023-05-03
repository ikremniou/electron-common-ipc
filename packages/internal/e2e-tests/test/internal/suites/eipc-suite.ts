import { GlobalContainer, IpcBusProcessType } from '@electron-common-ipc/universal';
import { expect } from 'chai';
import { findFirstFreePort } from 'socket-port-helpers';

import type { BasicSmokeContext } from './smoke-suite';
import type { IpcBusBrokerProxy } from '../clients/broker/broker-proxy';
import type { ClientHost, ClientSubscribeReport, ProxyCounterConfirm } from '../clients/echo-contract';
import type { QueryStateConnector, QueryStateTransport } from '@electron-common-ipc/universal';
import type { IpcBusClient } from 'electron-common-ipc';
import type { IpcBusBridgeImpl } from 'electron-common-ipc/lib/main/IpcBusBridgeImpl';

export interface EipcContext extends BasicSmokeContext {
    /**
     * Create Node process instance and activates Ipc client on it.
     * @param port The port Net client will connect to
     */
    startClientHostNode(port: number): Promise<ClientHost>;
}

export function shouldRunEipcRemoteBrokerTests(suiteId: string, ctx: EipcContext) {
    const sampleEipcObject = {
        prop1: '1',
        prop2: 2,
        array: [1, 2, 3, 4, '5', null],
    };

    async function waitForBrokerChannels() {
        // TODO: probably we should broadcast the message to renderers.
        // This has to be addressed in future. This is due to Main has no
        // channels available by the time the send will be called.
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    describe(`[${suiteId}] should exchange messages between node and renderer`, () => {
        let localMainClient: IpcBusClient;
        let brokerAndBridge: IpcBusBrokerProxy;
        let nodeHost: ClientHost;
        let rendererHost: ClientHost;
        let port: number;

        before(async () => {
            GlobalContainer.reset();
            port = await findFirstFreePort({
                portRange: '>=49352',
                testConnection: true,
                testDataTransfer: true,
                hostname: '127.0.0.1',
            });
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

            await waitForBrokerChannels();

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

            rendererHost.sendCommand({
                type: 'start-echo-service-proxy',
                channel: 'some-service',
                counterEvents: [[3, 'some-event']],
            });
            await rendererHost.waitForMessage('done');

            nodeHost.sendCommand({
                type: 'emit-echo-service-event',
                channel: 'some-service',
                event: 'some-event',
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

        it('should create service on renderer process and proxy on node process and communicate', async () => {
            rendererHost.sendCommand({
                type: 'start-echo-service',
                channel: 'some-service',
            });
            await rendererHost.waitForMessage('done');

            nodeHost.sendCommand({
                type: 'start-echo-service-proxy',
                channel: 'some-service',
                counterEvents: [[3, 'some-event']],
            });
            await nodeHost.waitForMessage('done');

            rendererHost.sendCommand({
                type: 'emit-echo-service-event',
                channel: 'some-service',
                event: 'some-event',
                data: sampleEipcObject,
                times: 3,
            });
            const result = await Promise.all([
                rendererHost.waitForMessage('done'),
                nodeHost.waitForMessage('counter-confirm'),
            ]);
            const counterConfirm = result[1] as ProxyCounterConfirm;
            expect(counterConfirm.lastEventData).to.be.deep.eq(sampleEipcObject);

            nodeHost.sendCommand({
                type: 'stop-echo-service-proxy',
                channel: 'some-service',
            });
            await nodeHost.waitForMessage('done');
            rendererHost.sendCommand({
                type: 'stop-echo-service',
                channel: 'some-service',
            });
            await rendererHost.waitForMessage('done');
        });

        it('should send message from main client(local) to node process', async () => {
            nodeHost.sendCommand({
                type: 'subscribe-report',
                channel: 'test-channel-3',
            });
            await nodeHost.waitForMessage('done');

            await waitForBrokerChannels();

            localMainClient.send('test-channel-3', sampleEipcObject);
            const report = (await nodeHost.waitForMessage('client-subscribe-report')) as ClientSubscribeReport;

            expect(report.data).to.be.deep.eq(sampleEipcObject);
            expect(report.event.channel).to.be.eq('test-channel-3');
        });

        it('should send message from main client(local) to renderer process', async () => {
            rendererHost.sendCommand({
                type: 'subscribe-report',
                channel: 'test-channel-3',
            });
            await rendererHost.waitForMessage('done');

            localMainClient.send('test-channel-3', sampleEipcObject);
            const report = (await rendererHost.waitForMessage('client-subscribe-report')) as ClientSubscribeReport;

            expect(report.data).to.be.deep.eq(sampleEipcObject);
            expect(report.event.channel).to.be.eq('test-channel-3');
        });

        it('should able to communicate node-to-node when bridge is connected', async () => {
            const nodeHost2 = await ctx.startClientHostNode(port);
            nodeHost2.sendCommand({
                type: 'subscribe-report',
                channel: 'node-host-2',
            });
            await nodeHost2.waitForMessage('done');

            nodeHost.sendCommand({
                type: 'send',
                channel: 'node-host-2',
                data: sampleEipcObject,
            });

            const result = await Promise.all([
                nodeHost.waitForMessage('done'),
                nodeHost2.waitForMessage('client-subscribe-report'),
            ]);

            const report = result[1] as ClientSubscribeReport;
            expect(report.data).to.be.deep.eq(sampleEipcObject);
            expect(report.event.channel).to.be.eq('node-host-2');
            nodeHost2.close();
        });

        describe('should perform service utilities', () => {
            let qsResult: ReturnType<IpcBusBridgeImpl['getQueryState']>;

            before(async () => {
                rendererHost.sendCommand({
                    type: 'subscribe-report',
                    channel: 'some-test-channel',
                });
                await rendererHost.waitForMessage('done');
                nodeHost.sendCommand({
                    type: 'subscribe-report',
                    channel: 'some-broker-channel',
                });
                await nodeHost.waitForMessage('done');

                const bridge: IpcBusBridgeImpl = brokerAndBridge.getInstance?.();
                bridge.startQueryState();
                await new Promise((resolve) => setTimeout(resolve, 500));
                qsResult = bridge.getQueryState();
            });

            it('should collect query state and not to be empty after 100 ms', () => {
                expect(qsResult).to.be.not.empty;
                // Main, RendererHost, Broker, NodeHost
                expect(qsResult.size).to.be.eq(4);
            });

            it('should send query state from the main and receive information about all main components', () => {
                const mainEntry = qsResult.get(Array.from(qsResult.keys()).find((entry) => entry.startsWith('Main')));
                expect(mainEntry.find((x) => x.type === 'renderer-bridge')).to.exist;
                expect(mainEntry.find((x) => x.type === 'connector-main')).to.exist;
                expect(mainEntry.find((x) => x.type === 'transport')).to.exist;
                expect(mainEntry.find((x) => x.type === 'transport-socket-bridge')).to.exist;
            });

            it('should send query state from the main and get subscribed channel from the renderer bridge', () => {
                const mainEntry = qsResult.get(Array.from(qsResult.keys()).find((entry) => entry.startsWith('Main')));
                const rendererBridge = mainEntry.find((x) => x.type === 'renderer-bridge') as QueryStateTransport;
                expect(rendererBridge.channels['some-test-channel']).to.exist;
                expect(rendererBridge.channels['some-test-channel'].refCount).to.be.eq(1);
            });

            it('should send query state from the main and find the subscribed channel in the node broker', () => {
                let broker: QueryStateTransport;
                const nodeHosts = Array.from(qsResult.keys()).filter((entry) => entry.startsWith('Node'));
                for (let index = 0; index < nodeHosts.length; index++) {
                    const nodeProcess = qsResult.get(nodeHosts[index]);
                    if (nodeProcess[0].type === 'broker') {
                        broker = nodeProcess[0] as QueryStateTransport;
                    }
                }

                expect(broker.channels['some-broker-channel']).to.exist;
                expect(broker.channels['some-broker-channel'].refCount).to.be.eq(1);
            });

            it('should send query state and get the transport information back', () => {
                const mainEntry = qsResult.get(
                    Array.from(qsResult.keys()).find((entry) => entry.startsWith('Renderer'))
                );
                const rendererTransport = mainEntry.find((x) => x.type === 'transport') as QueryStateTransport;

                expect(rendererTransport.channels['some-test-channel']).to.exist;
                expect(rendererTransport.channels['some-test-channel'].refCount).to.be.eq(1);
            });

            it('should send query state and get the connector information back', () => {
                const mainEntry = qsResult.get(
                    Array.from(qsResult.keys()).find((entry) => entry.startsWith('Renderer'))
                );
                const rendererConnector = mainEntry.find((x) => x.type === 'connector-renderer') as QueryStateConnector;

                expect(rendererConnector.peer).to.exist;
                expect(rendererConnector.peer.type).to.be.eq(IpcBusProcessType.Renderer);
            });

            // check message stamp?
        });
    });
}

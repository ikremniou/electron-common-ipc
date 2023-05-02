import { CreateIpcBusBridge, CreateIpcBusClient } from 'electron-common-ipc';

import * as bigData from './big-data.json';
import { remoteNodeBrokerFactory } from '../../internal/clients/broker/node-broker-factory';
import { wsLocalBrokerFactory } from '../../internal/clients/broker/ws-local-broker-factory';
import { wsiLocalBrokerFactory } from '../../internal/clients/broker/wsi-local-broker-factory';
import { startClientHost as startRendererClient } from '../../internal/clients/browser/echo-contract-browser';
import { startClientHost as startLocalClient } from '../../internal/clients/local/local-echo-contract';
import { startClientHost as startNodeClient } from '../../internal/clients/node/echo-contract-node';
import { Benchmark } from '../../internal/perf/benchmark';

import type { IpcBusBrokerProxy } from '../../internal/clients/broker/broker-proxy';
import type { ClientHost } from '../../internal/clients/echo-contract';
import type { IpcBusBridge } from 'electron-common-ipc';

const numberOfEvents = process.env.NUMBER_OF_EVENTS ? parseInt(process.env.NUMBER_OF_EVENTS) : 100;
const testObject = process.env.TEST_OBJECT
    ? JSON.parse(process.env.TEST_OBJECT)
    // : [1, 3, 2, { formula: 'RDP.Data', args: [1, 2, 3, 4, 5, 6] }];
    : bigData;
const numberOfIterations = process.env.TEST_ITERATIONS ? Number(process.env.TEST_ITERATIONS) : 1;

describe('Renderer to Node process', () => {
    async function emitEventsFromServiceProxyTest(renderer: ClientHost, node: ClientHost, name: string) {
        const benchmark = new Benchmark({ iterations: numberOfIterations });
        await benchmark.recordAsync(name, async () => {
            renderer.sendCommand({
                type: 'start-echo-service',
                channel: 'test-service',
            });
            await renderer.waitForMessage('done');

            node.sendCommand({
                type: 'start-echo-service-proxy',
                channel: 'test-service',
                counterEvents: [[numberOfEvents, 'data-event']],
            });
            await node.waitForMessage('done');

            renderer.sendCommand({
                type: 'emit-echo-service-event',
                channel: 'test-service',
                event: 'data-event',
                data: testObject,
                times: numberOfEvents,
            });
            await node.waitForMessage('counter-confirm');

            renderer.sendCommand({
                type: 'stop-echo-service',
                channel: 'test-service',
            });

            renderer.sendCommand({
                type: 'stop-echo-service-proxy',
                channel: 'test-service',
            });
        });
    }

    const port = 50176;
    let rendererProcess: ClientHost;
    let commonClientHost: ClientHost;
    describe('@electron-common-ipc/web-socket(-browser) - native JSON', () => {
        let broker: IpcBusBrokerProxy;

        beforeEach(async () => {
            broker = await wsiLocalBrokerFactory(port);
            rendererProcess = await startRendererClient('wsi', port, false);
            commonClientHost = await startLocalClient('wsi', port);
        });

        afterEach(async () => {
            await Promise.all([broker.close(), rendererProcess.close(), commonClientHost.close()]);
        });

        it('should create a service on the renderer process and send data events to node process', async () => {
            await emitEventsFromServiceProxyTest(
                rendererProcess,
                commonClientHost,
                '[WSI] Proxy events from Node to Renderer'
            );
        });
    });

    describe('@electron-common-ipc/web-socket(-browser) - default', () => {
        let broker: IpcBusBrokerProxy;

        beforeEach(async () => {
            broker = await wsLocalBrokerFactory(port);
            rendererProcess = await startRendererClient('ws', port, false);
            commonClientHost = await startLocalClient('ws', port);
        });

        afterEach(async () => {
            await Promise.all([broker.close(), rendererProcess.close(), commonClientHost.close()]);
        });

        it('should create a service on the renderer process and send data events to node process', async () => {
            await emitEventsFromServiceProxyTest(
                rendererProcess,
                commonClientHost,
                '[WS] Proxy events from Node to Renderer'
            );
        });
    });

    describe('electron-common-ipc(Electron IPC + Node TCP Socket)', () => {
        let broker: IpcBusBrokerProxy;
        let bridge: IpcBusBridge;

        beforeEach(async () => {
            broker = await remoteNodeBrokerFactory('eipc', port);
            bridge = CreateIpcBusBridge();
            await bridge.connect(port);

            // TODO: we need to create a client in order for transport to be initialized
            // this has to be fixed in electron-common-ipc
            const dummyClient = CreateIpcBusClient();
            dummyClient.connect(port);

            rendererProcess = await startRendererClient('eipc', port, false);
            commonClientHost = await startNodeClient('eipc', port, true);
        });

        afterEach(async () => {
            await Promise.all([broker.close(), bridge.close(), rendererProcess.close(), commonClientHost.close()]);
        });

        it('should create a service on the renderer process and send data events to node process', async () => {
            await emitEventsFromServiceProxyTest(
                rendererProcess,
                commonClientHost,
                '[EIPC] Proxy events from Node to Renderer'
            );
        });
    });
});

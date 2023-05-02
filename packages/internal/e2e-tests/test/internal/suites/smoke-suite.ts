import { GlobalContainer } from '@electron-common-ipc/universal';
import { expect } from 'chai';
import { findFirstFreePort } from 'socket-port-helpers';

import { EchoServiceClass } from '../clients/echo-contract';

import type { IpcBusBrokerProxy } from '../clients/broker/broker-proxy';
import type { ClientHost, ToClientProcessMessage, ToMainProcessMessage } from '../clients/echo-contract';
import type { IpcBusClient, IpcBusServiceProxy, IpcBusService } from '@electron-common-ipc/universal';

export interface BasicContext {
    /**
     * Create a broker that will be hosted esther locally or remotely
     * The connection should be established within this function
     */
    createBroker: (port: number) => Promise<IpcBusBrokerProxy>;
    /**
     * Create a client that will be hosted locally within current JS context
     */
    createBusClient: () => IpcBusClient;
    /**
     * Start client host (as node or renderer process for example)
     * @param port The port that client host will connect bus client to
     */
    startClientHost(port: number): Promise<ClientHost>;
}

export interface BasicSmokeContext extends BasicContext {
    /**
     * Create a service proxy to execute service-to-serviceProxy tests
     */
    createIpcBusServiceProxy: (client: IpcBusClient, serviceName: string) => IpcBusServiceProxy;
    createIpcBusService: (client: IpcBusClient, serviceName: string, serviceImpl: unknown) => IpcBusService;
}

export const shouldPerformBasicTests = (suiteId: string, ctx: BasicSmokeContext) => {
    let busPort: number;
    let broker: IpcBusBrokerProxy;
    let brokerClient: IpcBusClient;

    describe(`[${suiteId}] should perform server to client communication`, () => {
        let child: ClientHost;
        before(async () => {
            GlobalContainer.reset();
            busPort = await findFirstFreePort({ testConnection: true, testDataTransfer: true });
            broker = await ctx.createBroker(busPort);

            brokerClient = ctx.createBusClient();
            await brokerClient.connect(busPort);
            child = await ctx.startClientHost(busPort);
        });

        after(async () => {
            await broker.close();
            await brokerClient.close();
            child.close();
        });

        beforeEach(() => {
            brokerClient.removeAllListeners();
        });

        it('should subscribe to the channel and echo string back', async () => {
            const echoChannel = 'replayChannel_0';
            const channel = 'testChannel_0';
            const processMessage: ToClientProcessMessage = {
                type: 'subscribe-echo',
                channel,
                echoChannel,
            };

            child.sendCommand(processMessage);
            await child.waitForMessage('done');

            return new Promise((resolve) => {
                brokerClient.addListener(echoChannel, (_event, messageArgs) => {
                    expect(messageArgs).to.be.eq('messageArg');
                    resolve();
                });
                brokerClient.send(channel, 'messageArg');
            });
        });

        it('should unsubscribe from the replay channel', async () => {
            const echoChannel = 'replayChannel_1';
            const channel = 'testChannel_1';
            const processMessage: ToClientProcessMessage = {
                type: 'subscribe-echo',
                channel,
                echoChannel,
            };

            child.sendCommand(processMessage);
            await child.waitForMessage('done');

            const unsubscribeMes: ToClientProcessMessage = {
                type: 'unsubscribe-all',
                channel,
            };

            child.sendCommand(unsubscribeMes);
            await child.waitForMessage('done');

            let isMessageReceived = false;
            brokerClient.addListener(echoChannel, () => {
                isMessageReceived = true;
            });

            expect(brokerClient.send(channel, 'message')).to.be.true;

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 100);
            });

            expect(isMessageReceived).to.be.false;
        });

        it('should send reply multiple times when subscribed multiple times', async () => {
            const numberOfSubs = 2;
            const echoChannel = 'replayChannel_2';
            const channel = 'testChannel_2';
            const processMessage: ToClientProcessMessage = {
                type: 'subscribe-echo',
                channel,
                echoChannel,
            };

            for (let i = 0; i < numberOfSubs; i++) {
                child.sendCommand(processMessage);
                await child.waitForMessage('done');
            }

            return new Promise<void>((resolve) => {
                let countOfCalls = 0;
                brokerClient.addListener(echoChannel, (_event, data) => {
                    expect(data).to.be.eq(10000);
                    if (++countOfCalls === numberOfSubs) {
                        resolve();
                    }
                });
                brokerClient.send(channel, 10000);
            });
        });

        it('should sendTo the peer that echoed the message', async () => {
            const echoChannel = 'replayChannel_3';
            const channel = 'testChannel_3';
            const subMessage: ToClientProcessMessage = {
                type: 'subscribe-echo',
                channel,
                echoChannel,
            };

            child.sendCommand(subMessage);
            await child.waitForMessage('done');

            return new Promise<void>((resolve) => {
                let isCalledFirstTime = false;
                brokerClient.addListener(echoChannel, (event, data) => {
                    expect(data).to.be.deep.eq([1, 2, 3, 4, 5, '6']);
                    if (!isCalledFirstTime) {
                        brokerClient.sendTo(event.sender, channel, data);
                        isCalledFirstTime = true;
                    } else {
                        resolve();
                    }
                });
                brokerClient.send(channel, [1, 2, 3, 4, 5, '6']);
            });
        });

        it('should request and requestTo and return correct response', async () => {
            const timeout = 2000;
            const echoChannel = 'replayChannel_4';
            const channel = 'testChannel_4';
            const processMessage: ToClientProcessMessage = {
                type: 'subscribe-echo-request',
                channel,
                echoChannel,
            };

            child.sendCommand(processMessage);
            await child.waitForMessage('done');

            let isCalledFirstTime = false;
            brokerClient.addListener(echoChannel, async (event, data: unknown) => {
                expect(event.request).to.exist;
                if (!isCalledFirstTime) {
                    isCalledFirstTime = true;
                    await brokerClient.requestTo(event.sender, channel, timeout, data);
                    event.request.resolve(data);
                } else {
                    event.request.resolve(data);
                }
            });

            const response = await brokerClient.request(channel, timeout, { message: 'hello' });
            expect(response.err).to.not.exist;
            expect(response.payload).has.property('message', 'hello');
        });

        it('should postMessage and postMessageTo and echo same message back', async () => {
            const echoChannel = 'replayChannel_5';
            const channel = 'testChannel_5';
            const processMessage: ToClientProcessMessage = {
                type: 'subscribe-echo',
                channel,
                echoChannel,
            };

            child.sendCommand(processMessage);
            await child.waitForMessage('done');

            return new Promise<void>((resolve) => {
                let isCalledFirstTime = false;
                brokerClient.addListener(echoChannel, (event, data) => {
                    expect(data).to.be.eq('test');
                    if (!isCalledFirstTime) {
                        brokerClient.postMessageTo(event.sender, channel, data);
                        isCalledFirstTime = true;
                    } else {
                        resolve();
                    }
                });
                brokerClient.postMessage(channel, 'test');
            });
        });

        it('should create new client send message, receive echo and close client correctly', async () => {
            const newClient = ctx.createBusClient();
            await newClient.connect(busPort);

            const echoChannel = 'replayChannel_6';
            const channel = 'testChannel_6';
            const processMessage: ToClientProcessMessage = {
                type: 'subscribe-echo-request',
                channel,
                echoChannel,
            };

            child.sendCommand(processMessage);
            await child.waitForMessage('done');

            newClient.addListener(echoChannel, (event, data) => {
                expect(event.request).to.exist;
                expect(data).has.property('prop1', null);
                expect(data).has.property('prop2', 0);
                event.request.resolve('done');
            });
            const response = await newClient.request(channel, 2000, { prop1: null, prop2: 0 });
            expect(response.payload).to.be.eq('done');
            await newClient.close();
        });
    });

    describe(`[${suiteId}] should perform client to client communication`, () => {
        let childClient1: ClientHost;
        let childClient2: ClientHost;

        before(async () => {
            busPort = await findFirstFreePort({ testConnection: true, testDataTransfer: true });
            broker = await ctx.createBroker(busPort);
            brokerClient = ctx.createBusClient();
            await brokerClient.connect(busPort);
            brokerClient.removeAllListeners();

            [childClient1, childClient2] = await Promise.all([
                ctx.startClientHost(busPort),
                ctx.startClientHost(busPort),
            ]);
        });

        after(async () => {
            await broker.close();
            await brokerClient.close();
            childClient1.close();
            childClient2.close();
        });

        it('should be able to establish communication and exchange messages between clients', async () => {
            const child1SubChannel = 'channel-1';
            const child2SubChannel = 'channel-2';

            let child1Mes: ToClientProcessMessage = {
                type: 'subscribe-report',
                channel: child1SubChannel,
            };
            let child2Mes: ToClientProcessMessage = { ...child1Mes, channel: child2SubChannel };

            childClient1.sendCommand(child1Mes);
            childClient2.sendCommand(child2Mes);
            await Promise.all([childClient1.waitForMessage('done'), childClient2.waitForMessage('done')]);

            // send message from client_1 to client_2
            child1Mes = {
                type: 'send',
                channel: child2SubChannel,
                data: 'message_1',
            };

            childClient1.sendCommand(child1Mes);
            await childClient2.waitForMessage((message: ToMainProcessMessage) => {
                if (typeof message !== 'string' && message.type === 'client-subscribe-report') {
                    expect(message.data).to.be.eq('message_1');
                    expect(message.event.channel).to.be.eq(child2SubChannel);
                    return true;
                }
                return false;
            });

            // send message from client_2 to client_1
            child2Mes = {
                type: 'send',
                channel: child1SubChannel,
                data: 'message_2',
            };

            childClient2.sendCommand(child2Mes);
            await childClient1.waitForMessage((message: ToMainProcessMessage) => {
                if (typeof message !== 'string' && message.type === 'client-subscribe-report') {
                    expect(message.data).to.be.eq('message_2');
                    expect(message.event.channel).to.be.eq(child1SubChannel);
                    return true;
                }
                return false;
            });
        });

        it('should receive two callbacks when client number 2 subscribes two times to same channel', async () => {
            const child1SubChannel = 'channel-3';
            const child1Mes: ToClientProcessMessage = {
                type: 'subscribe-report',
                channel: child1SubChannel,
            };

            childClient1.sendCommand(child1Mes);
            await childClient1.waitForMessage('done');
            childClient1.sendCommand(child1Mes);
            await childClient1.waitForMessage('done');

            const child2Mes: ToClientProcessMessage = {
                type: 'send',
                channel: child1SubChannel,
                data: 'any',
            };

            let isCalledFirstTime = false;
            childClient2.sendCommand(child2Mes);
            await childClient1.waitForMessage((message: ToMainProcessMessage) => {
                if (typeof message !== 'string' && message.type === 'client-subscribe-report') {
                    if (!isCalledFirstTime) {
                        isCalledFirstTime = true;
                        return false;
                    }
                    return true;
                }
                return false;
            });
        });

        it('should instantly send message to the in proc client', async () => {
            const inProcClient1 = ctx.createBusClient();
            await inProcClient1.connect(busPort);
            const testChannel = 'in_proc_channel';

            let calledInstantly = false;
            inProcClient1.addListener(testChannel, (_event) => {
                calledInstantly = true;
            });

            brokerClient.send(testChannel);

            expect(calledInstantly).to.be.true;
            inProcClient1.close();
        });
    });

    describe(`[${suiteId}] should connect and close for client, broker and host`, () => {
        let childProcess: ClientHost;

        beforeEach(async () => {
            busPort = await findFirstFreePort({ testConnection: true, testDataTransfer: true });
            broker = await ctx.createBroker(busPort);
            brokerClient = ctx.createBusClient();
            await brokerClient.connect(busPort);

            childProcess = await ctx.startClientHost(busPort);
        });

        afterEach(async () => {
            await brokerClient.close();
            await broker.close();
            childProcess.close();
        });

        it('should be able to close connection correctly if child process was terminated before close', async () => {
            childProcess.close();
            await brokerClient.close();
            await broker.close();
        });

        it('should be able to close connection correctly when child process not terminated', async () => {
            await broker.close();
            await brokerClient.close();
        });

        it('should send client to client messages correctly if one of the host was terminated', async () => {
            const clientHost1 = await ctx.startClientHost(busPort);
            const clientHost2 = await ctx.startClientHost(busPort);

            const subTestChannel1 = 'test_channel_1';
            const subTestChannel2 = 'test_channel_2';
            const subTestChannel3 = 'test_channel_2';

            const message: ToClientProcessMessage = {
                type: 'subscribe-report',
                channel: subTestChannel1,
            };
            clientHost1.sendCommand(message);
            message.channel = subTestChannel2;
            clientHost2.sendCommand(message);
            message.channel = subTestChannel3;
            childProcess.sendCommand(message);

            await Promise.all([
                clientHost1.waitForMessage('done'),
                clientHost2.waitForMessage('done'),
                childProcess.waitForMessage('done'),
            ]);

            clientHost2.close();

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 100);
            });

            // send message from client 1 to client 3
            const sendMessage: ToClientProcessMessage = { type: 'send', channel: subTestChannel3, data: 'any' };
            clientHost1.sendCommand(sendMessage);

            let receivedData: string = '';
            await childProcess.waitForMessage((message) => {
                if (typeof message !== 'string' && message.type === 'client-subscribe-report') {
                    receivedData = message.data as string;
                    return true;
                }
                return false;
            });

            clientHost1.close();
            expect(receivedData).to.be.equal('any');
        });
    });

    describe(`[${suiteId}] should perform service-to-serviceProxy communication`, () => {
        let clientHost: ClientHost;

        before(async () => {
            broker = await ctx.createBroker(busPort);
            brokerClient = ctx.createBusClient();
            await brokerClient.connect(busPort);

            clientHost = await ctx.startClientHost(busPort);
        });

        after(async () => {
            await brokerClient.close();
            await broker.close();

            clientHost.close();
        });

        async function startLocalService(instance: EchoServiceClass, event?: [number, string]): Promise<IpcBusService> {
            const service = ctx.createIpcBusService(brokerClient, 'local-service', instance);
            service.start();
            clientHost.sendCommand({
                type: 'start-echo-service-proxy',
                channel: 'local-service',
                counterEvents: event ? [event] : undefined,
            });
            await clientHost.waitForMessage('done');
            return service;
        }

        async function stopLocalService(service: IpcBusService): Promise<void> {
            clientHost.sendCommand({ type: 'stop-echo-service-proxy', channel: 'local-service' });
            await clientHost.waitForMessage('done');
            service.stop();
        }

        it('should start and stop service successfully', async () => {
            const serviceInstance = new EchoServiceClass();
            const service = await expect(startLocalService(serviceInstance)).eventually.fulfilled;
            await expect(stopLocalService(service)).eventually.fulfilled;
        });

        it('should create service locally and respond to the wrapper calls', async () => {
            let isCalledFromProxy = false;
            const serviceInstance = new EchoServiceClass();
            serviceInstance.echoMethod = (data) => {
                isCalledFromProxy = true;
                expect(data[0]).to.be.eq('test');
                return Promise.resolve(data);
            };
            const service = await startLocalService(serviceInstance);
            clientHost.sendCommand({ type: 'call-on-echo-service-proxy', channel: 'local-service', data: ['test'] });
            await clientHost.waitForMessage('done');
            await stopLocalService(service);
            expect(isCalledFromProxy).to.be.true;
        });

        it('should receive call in the call handler if wrapper has same method', async () => {
            const serviceInstance = new EchoServiceClass();
            const service = await startLocalService(serviceInstance);
            let isCalledInHandler = false;
            service.registerCallHandler('echoMethod', () => {
                isCalledInHandler = true;
            });

            clientHost.sendCommand({ type: 'call-on-echo-service-proxy', channel: 'local-service', data: ['test'] });
            await clientHost.waitForMessage('done');
            await stopLocalService(service);
            expect(isCalledInHandler).to.be.true;
        });

        it('should send 2 events to service proxy and await proxy confirmation', async () => {
            const serviceInstance = new EchoServiceClass();
            const service = await startLocalService(serviceInstance, [2, 'my-event']);
            service.sendEvent('my-event', 1, 2, 3, 4, '5');
            service.sendEvent('my-event', 1, 2, 3, 4, '5');
            await expect(clientHost.waitForMessage('counter-confirm')).eventually.fulfilled;
            await stopLocalService(service);
        });
    });

    describe(`[${suiteId}] should perform serviceProxy-to-service communication`, () => {
        let clientHost: ClientHost;
        let serviceProxy: IpcBusServiceProxy;

        before(async () => {
            broker = await ctx.createBroker(busPort);
            brokerClient = ctx.createBusClient();
            await brokerClient.connect(busPort);

            clientHost = await ctx.startClientHost(busPort);
        });

        after(async () => {
            await brokerClient.close();
            await broker.close();

            clientHost.close();
        });

        beforeEach(async () => {
            clientHost.sendCommand({ type: 'start-echo-service', channel: 'test-service' });
            await clientHost.waitForMessage('done');
            serviceProxy = ctx.createIpcBusServiceProxy(brokerClient, 'test-service');
            await serviceProxy.connect();
        });

        afterEach(async () => {
            clientHost.sendCommand({ type: 'stop-echo-service', channel: 'test-service' });
            await clientHost.waitForMessage('done');
            await serviceProxy.close();
        });

        it('should return same wrapper in connect called multiple times', async () => {
            const wrapper: EchoServiceClass = await serviceProxy.connect();
            expect(wrapper).to.exist;
        });

        it('should receive echo messages from the service', async () => {
            const wrapper: EchoServiceClass = await serviceProxy.connect();
            const response = await wrapper.echoMethod(['arg', { prop: 'value' }]);
            expect(response).to.be.deep.equal(['arg', { prop: 'value' }]);
        });

        it('should receive event that is emitted from the service', async () => {
            const wrapper: EchoServiceClass = await serviceProxy.connect();

            const echoEventPromise = new Promise<void>((resolve) => {
                const eventName = 'echo-event';
                wrapper.on(eventName, (data) => {
                    expect(data).to.be.equal('any');
                    resolve();
                });
                clientHost.sendCommand({
                    type: 'emit-echo-service-event',
                    channel: 'test-service',
                    event: eventName,
                    data: 'any',
                });
            });

            await expect(echoEventPromise).to.be.eventually.fulfilled;
        });
    });
};

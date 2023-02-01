import { performance as perf, PerformanceObserver } from 'perf_hooks';

import { writeReportTo } from './perf-utilities';

import type { IpcBusBrokerProxy } from '../../clients/broker/broker-proxy';
import type { ClientHost, ToClientProcessMessage } from '../../clients/echo-contract';
import type { PerfContext, PerfResult} from './perf-utilities';

export interface PerfEchoContext extends PerfContext {
    numberOfEchos: number;
}

/**
 * This performance test is based on the echo messages:
 * First we subscribe to the primary channel on the remote host(process)
 * then we subscribe to the echo channel on the current host and wait for the messages
 * There are 2 actions "echo_wait" and "to_dispatch":
 * "to_dispatch" indicates the time taken to dispatch messages
 * "echo_wait" indicates how much time after the dispatch of all messages we waited for replies
 * @param ctx The context of the testing suite
 */
export function perfEchoSuite(ctx: PerfEchoContext): void {
    let broker: IpcBusBrokerProxy;
    const busPort = 33333;
    const brokerClient = ctx.createBusClient();
    const perfResult: PerfResult[] = [];

    const channel = 'perf_channel';
    const echoChannel = 'echo_perf_channel';
    let clientHost: ClientHost;

    before(async () => {
        broker = await ctx.createBroker(busPort);
        await brokerClient.connect(busPort);
        clientHost = await ctx.startClientHost(busPort);

        const subEcho: ToClientProcessMessage = {
            type: 'subscribe-echo',
            channel,
            echoChannel,
        };

        clientHost.sendCommand(subEcho);
        await clientHost.waitForMessage('done');
    });

    after(async () => {
        await broker.close();
        await brokerClient.close();
        clientHost.close();
        writeReportTo(perfResult, ctx.name, ctx.writeTo);
    });

    beforeEach(() => {
        brokerClient.removeAllListeners();
    });

    ctx.objectTypes.forEach((objectType) => {
        const objectToSend = JSON.parse(objectType);
        const currPerfResult: PerfResult = {
            iterations: [],
            objectType,
            name: ctx.name
        };

        describe(`Perf for object type: ${objectType}`, () => {
            let observer: PerformanceObserver;

            before(() => {
                observer = new PerformanceObserver((items) => {
                    for (const item of items.getEntries()) {
                        currPerfResult.iterations.push({ operation: item.name, time: item.duration });
                    }

                });
                observer.observe({ entryTypes: ['measure'] });
            });

            let index = 0;
            while (index < ctx.times) {
                index++;
                it(`should send simple message in loop and wait for all echoes. ${index}`, async () => {
                    const performancePromise = new Promise<void>((resolve) => {
                        let currentEchos = 0;
                        brokerClient.addListener(echoChannel, (_event, _data) => {
                            currentEchos++;
                            if (currentEchos === ctx.numberOfEchos) {
                                resolve();
                            }
                        });
                    });

                    perf.mark(`message_dispatch`);
                    for (let index = 0; index < ctx.numberOfEchos; index++) {
                        brokerClient.send(channel, objectToSend);
                    }

                    perf.mark(`wait_echo`);
                    await performancePromise;
                    perf.mark(`echo_done`);

                    perf.measure('to_dispatch', 'wait_echo', 'echo_done');
                    perf.measure('echo_wait', 'message_dispatch', 'wait_echo');
                    perf.clearMarks();
                });
            }

            after(() => {
                observer.disconnect();
                perfResult.push(currPerfResult);
            });
        });
    });
}

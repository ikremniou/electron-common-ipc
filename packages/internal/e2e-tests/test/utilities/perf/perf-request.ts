import { performance as perf, PerformanceObserver } from 'perf_hooks';

import { writeReportTo } from './perf-utilities';

import type { IpcBusBrokerProxy } from '../broker/broker-proxy';
import type { ClientHost, ProcessMessage } from '../echo-contract';
import type { PerfContext, PerfResult} from './perf-utilities';

export interface PerfRequestContext extends PerfContext {
    numberRequests: number;
}

export function perfRequestSuite(ctx: PerfRequestContext): void {
    let broker: IpcBusBrokerProxy;
    const busPort = 33333;
    const brokerClient = ctx.createBusClient();
    const perfResult: PerfResult[] = [];

    const channel = 'perf_channel';
    let clientHost: ClientHost;

    before(async () => {
        broker = await ctx.createBroker(busPort);
        await brokerClient.connect(busPort);
        clientHost = await ctx.startClientHost(busPort);

        const requestResolve: ProcessMessage = {
            type: 'request-resolve',
            channel,
            content: {
                data: true
            }
        };

        clientHost.sendCommand(requestResolve);
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
                it(`should send request and wait for all responses. ${index}`, async () => {
                    const promises: Promise<unknown>[] = [];
                    perf.mark(`message_dispatch`);
                    for (let index = 0; index < ctx.numberRequests; index++) {
                        promises.push(brokerClient.request(channel, -1, objectToSend));
                    }

                    perf.mark(`wait_echo`);
                    await Promise.all(promises);
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

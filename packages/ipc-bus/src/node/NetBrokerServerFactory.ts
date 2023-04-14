import { executeInTimeout } from '@electron-common-ipc/universal';
import { createServer } from 'net';

import { NetBrokerServer } from './NetBrokerServer';

import type { Logger, BrokerServerFactory, BrokerConnectOptions, BrokerServer } from '@electron-common-ipc/universal';

export class NetBrokerServerFactory implements BrokerServerFactory {
    constructor(private readonly _logger: Logger) {}

    create(options: BrokerConnectOptions): Promise<BrokerServer> {
        if (options.port === undefined && options.path === undefined) {
            throw new Error('Connection options not provided');
        }

        const server = createServer();
        server.unref();

        return executeInTimeout(
            options.timeoutDelay,
            (resolve, reject) => {
                server.addListener('listening', () => {
                    server.removeAllListeners();
                    this._logger?.info(
                        `[IPCBus:Broker] Listening for incoming connections on ${JSON.stringify(options)}`
                    );
                    resolve(new NetBrokerServer(server, this._logger));
                });
                server.addListener('error', (err) => {
                    const msg = `[IPCBus:Broker] error = ${err} on ${JSON.stringify(options)}`;
                    server.removeAllListeners();
                    reject(msg);
                });
                server.addListener('close', () => {
                    const msg = `[IPCBus:Broker] close on ${JSON.stringify(options)}`;
                    reject(msg);
                });

                if (options.path) {
                    server.listen(options.path);
                } else if (options.port && options.host) {
                    server.listen(options.port, options.host);
                } else {
                    server.listen(options.port);
                }
            },
            (reject) => {
                const msg = `[IPCBus:Broker] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(
                    options
                )}`;
                reject(msg);
            }
        );
    }
}

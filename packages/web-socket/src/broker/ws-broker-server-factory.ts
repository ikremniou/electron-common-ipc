import { executeInTimeout } from '@electron-common-ipc/universal';
import { WebSocketServer } from 'ws';

import { WsBrokerServer } from './ws-broker-server';

import type { BrokerConnectOptions, BrokerServer, BrokerServerFactory, JsonLike } from '@electron-common-ipc/universal';

export class WsBrokerServerFactory implements BrokerServerFactory {
    constructor(private readonly _json: JsonLike) {}

    public create(options: BrokerConnectOptions): Promise<BrokerServer> {
        options.host = options.host || '127.0.0.1';

        if (!options.port) {
            throw new Error(`You must specify 'port' parameter to start Broker`);
        }

        if (options.timeoutDelay && options.timeoutDelay < 0) {
            throw new Error(`The 'timeoutDelay' parameter must be >= 0.`);
        }

        const server = new WebSocketServer({ host: options.host, port: options.port, clientTracking: false });
        return executeInTimeout(
            options.timeoutDelay,
            (resolve, reject) => {
                server.on('error', (error) => {
                    server.removeAllListeners();
                    const message = `[WsBrokerFactory] error = ${error} on ${JSON.stringify(options)}`;
                    reject(new Error(message));
                });

                server.on('close', () => {
                    server.removeAllListeners();
                    const message = `[WsBrokerFactory] close on ${JSON.stringify(options)}`;
                    reject(new Error(message));
                });

                server.on('listening', () => {
                    server.removeAllListeners();
                    resolve(new WsBrokerServer(server, this._json));
                });
            },
            (reject) => {
                const message = `[WsBrokerFactory] Timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                reject(new Error(message));
            }
        );
    }
}

import { executeInTimeout } from '@electron-common-ipc/universal';
import { WebSocketServer } from 'ws';

import { WsBrokerServer } from './ws-broker-server';

import type { BrokerConnectOptions, BrokerServer, BrokerServerFactory } from '@electron-common-ipc/universal';

export class WsBrokerServerFactory implements BrokerServerFactory {
    public create(options: BrokerConnectOptions): Promise<BrokerServer> {
        if (options.path) {
            throw new Error(`You cannot specify 'path' parameter for Broker server.`);
        }

        if (!options.port) {
            throw new Error(`You must specify 'port' parameter to create Broker server.`);
        }

        if (options.timeoutDelay && options.timeoutDelay < 0) {
            throw new Error(`The 'timeoutDelay' parameter must be >= 0.`);
        }

        const server = new WebSocketServer({ host: '127.0.0.1', port: options.port, clientTracking: false });
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
                    resolve(new WsBrokerServer(server));
                });
            },
            (reject) => {
                const message = `[WsBrokerFactory] Timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                reject(new Error(message));
            }
        );
    }
}

import type { SocketClient } from '../client/socket-client';
import type { BrokerCloseOptions } from './broker';

export interface BrokerServer {
    close(options?: BrokerCloseOptions): Promise<void>;

    subscribe(
        onClose: () => void,
        onError: (error: Error) => void,
        onConnection: (client: SocketClient) => void): void;
    unsubscribe(): void;
}

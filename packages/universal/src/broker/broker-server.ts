import type { BrokerCloseOptions } from './broker';
import type { BrokerClient } from './broker-client';

export interface BrokerServer {
    close(options?: BrokerCloseOptions): Promise<void>;

    subscribe(
        onClose: () => void,
        onError: (error: Error) => void,
        onConnection: (client: BrokerClient) => void): void;
    unsubscribe(): void;
}

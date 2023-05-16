import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as tsSinon from 'ts-sinon';

import { IpcBusClientImpl, IpcBusCommandKind, IpcBusProcessType, IpcBusTransportMulti } from '../../src';

import type { IpcBusClient, IpcBusConnector } from '../../src';

describe('bus-client <=> multi-transport', () => {
    let client: IpcBusClient;
    let transport: IpcBusTransportMulti;
    let connector: tsSinon.StubbedInstance<IpcBusConnector>;
    const testChannel = 'test-channel';

    beforeEach(async () => {
        connector = tsSinon.stubInterface<IpcBusConnector>();
        connector.handshake.resolves({ peer: { id: 'foo', type: IpcBusProcessType.Main } });
        transport = new IpcBusTransportMulti(connector, () => 'uuid');
        client = new IpcBusClientImpl(() => 'client-1-id', new EventEmitter(), transport);
        await client.connect();
    });

    it('should emit event to all consumers when multiple listeners involved', () => {
        let calledInFirst = false;
        client.addListener(testChannel, () => {
            calledInFirst = true;
        });

        let calledInSecond = false;
        client.addListener(testChannel, () => {
            calledInSecond = true;
        });

        transport.onConnectorArgsReceived({
            channel: testChannel,
            kind: IpcBusCommandKind.SendMessage,
            peer: { id: 'bar', type: IpcBusProcessType.Renderer },
        }, ['a', 'b', 'c']);
        expect(calledInFirst).to.be.true;
        expect(calledInSecond).to.be.true;
    });

    it('should emit event to only for first consumer if second unsubscribed', () => {
        let calledInFirst = false;
        const callback = () => {
            calledInFirst = true;
        };
        client.addListener(testChannel, callback);

        let calledInSecond = false;
        client.addListener(testChannel, () => {
            calledInSecond = true;
        });

        client.removeListener(testChannel, callback);
        transport.onConnectorArgsReceived({
            channel: testChannel,
            kind: IpcBusCommandKind.SendMessage,
            peer: { id: 'bar', type: IpcBusProcessType.Renderer },
        }, ['a', 'b', 'c']);
        expect(calledInFirst).to.be.false;
        expect(calledInSecond).to.be.true;
    });

    it('should emit event to all consumers if more then one client is subscribed', () => {
        const client2 = new IpcBusClientImpl(() => 'client-2-id', new EventEmitter(), transport);

        let calledInFirst = false;
        client.addListener(testChannel, () => {
            calledInFirst = true;
        });

        let calledInSecond = false;
        client2.addListener(testChannel, () => {
            calledInSecond = true;
        });

        transport.onConnectorArgsReceived({
            channel: testChannel,
            kind: IpcBusCommandKind.SendMessage,
            peer: { id: 'bar', type: IpcBusProcessType.Renderer },
        }, ['a', 'b', 'c']);
        expect(calledInFirst).to.be.true;
        expect(calledInSecond).to.be.true;
    });
});

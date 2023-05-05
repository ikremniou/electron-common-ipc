import { expect } from 'chai';
import * as sinon from 'sinon';
import * as tsSinon from 'ts-sinon';

import { IpcBusProcessType, IpcBusTransportMulti } from '../../src';
import { ConsoleLogger } from '../../src/log/console-logger';

import type { ConnectorHandshake , MessageStamp } from '../../src';
import type { IpcBusConnector } from '../../src/client/bus-connector';
import type { IpcBusTransportClient } from '../../src/client/bus-transport';

describe('ipc-bus-transport-multi', () => {
    let transport: IpcBusTransportMulti;
    let connectorMock: tsSinon.StubbedInstance<IpcBusConnector>;
    let messageStamp: tsSinon.StubbedInstance<MessageStamp>;
    let logger: sinon.SinonStubbedInstance<ConsoleLogger>;
    let uuidProvider: sinon.SinonSpy;
    let transportClient: sinon.SinonStubbedInstance<IpcBusTransportClient>;

    beforeEach(() => {
        connectorMock = tsSinon.stubInterface<IpcBusConnector>();
        messageStamp = tsSinon.stubInterface<MessageStamp>();
        uuidProvider = sinon.fake(() => {
            return 'uuid';
        });
        logger = sinon.createStubInstance(ConsoleLogger);
        transportClient = sinon.stub({
            peer: { id: 'id', type: IpcBusProcessType.Undefined },
            listeners: (_event: string) => [],
        });

        transport = new IpcBusTransportMulti(connectorMock, uuidProvider, messageStamp, logger);
    });

    it('should be created successfully', () => {
        expect(transport).to.exist;
    });

    it('should add channel with count = 0', async () => {
        connectorMock.handshake.resolves({ peer: { } } as ConnectorHandshake);
        await transport.connect(transportClient, { });

        transport.addChannel(transportClient, 'hello_channel');
        expect(transport.getChannels()[0]).to.be.equal('hello_channel');
    });

    it('should add channel with count = 10', async () => {
        connectorMock.handshake.resolves({ peer: { } } as ConnectorHandshake);
        await transport.connect(transportClient, { });
        
        transport.addChannel(transportClient, 'hello_channel', 10);
        expect(transport.getChannels()[0]).to.be.equal('hello_channel');
    });

    it('should remove channel 10 subscribed channels', async () => {
        connectorMock.handshake.resolves({ peer: { } } as ConnectorHandshake);
        await transport.connect(transportClient, { });
        
        transport.addChannel(transportClient, 'hello_channel', 10);
        transport.removeChannel(transportClient, 'hello_channel');
        expect(transport.getChannels()).to.have.lengthOf(1);
        transport.removeChannel(transportClient, 'hello_channel', true);
        expect(transport.getChannels()).to.be.empty;
    });
});

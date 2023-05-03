import { IpcBusCommandKind, IpcBusProcessType } from '@electron-common-ipc/universal';
import { expect } from 'chai';
import { IpcPacketType } from 'socket-serializer';
import { stubInterface } from 'ts-sinon';

import { IpcBusTransportSocketBridge } from '../../src/main/IpcBusSocketBridge';

import type { IpcBusBridgeImpl } from '../../src/main/IpcBusBridgeImpl';
import type { IpcBusConnectorSocket } from '../../src/node/IpcBusConnectorSocket';
import type {
    IpcBusMessage,
    IpcBusPeer,
    Logger,
    MessageStamp,
    UuidProvider,
    IpcBusTransportClient,
} from '@electron-common-ipc/universal';
import type { StubbedInstance } from 'ts-sinon';

describe('IpcBusTransportSocketBridge', () => {
    let connector: StubbedInstance<IpcBusConnectorSocket>;
    let uuidProvider: StubbedInstance<UuidProvider>;
    let ipcBusBridge: StubbedInstance<IpcBusBridgeImpl>;
    let stamp: StubbedInstance<MessageStamp>;
    let logger: StubbedInstance<Logger>;
    let transportClient: StubbedInstance<IpcBusTransportClient>;

    const testPeer: IpcBusPeer = {
        id: 'id',
        type: IpcBusProcessType.Browser,
        name: 'testPeer',
    };
    const testMessage: IpcBusMessage = {
        channel: 'channel',
        kind: IpcBusCommandKind.AddChannelListener,
        peer: testPeer,
    };

    async function createSocketBridge(): Promise<IpcBusTransportSocketBridge> {
        connector = stubInterface<IpcBusConnectorSocket>();
        uuidProvider = stubInterface<UuidProvider>();
        ipcBusBridge = stubInterface<IpcBusBridgeImpl>();
        stamp = stubInterface<MessageStamp>();
        logger = stubInterface<Logger>();
        transportClient = stubInterface<IpcBusTransportClient>();

        connector.handshake.returns(Promise.resolve({ peer: testPeer }));
        const socketBridge = new IpcBusTransportSocketBridge(connector, ipcBusBridge, uuidProvider, stamp, logger);
        await socketBridge.connect(transportClient, {});
        return socketBridge;
    }

    it('should create instance of the socket bridge', async () => {
        const socketBridge = await createSocketBridge();
        expect(socketBridge).to.exist;
    });

    it('should broadcast the args data to connector', async () => {
        const socketBridge = await createSocketBridge();
        const result = socketBridge.broadcastData(testMessage, ['args']);
        expect(result).to.be.false;
        expect(connector.postMessage.calledOnce).to.be.true;
    });

    it('should broadcast the raw data to connector', async () => {
        const socketBridge = await createSocketBridge();
        testMessage.isRawData = true;
        const result = socketBridge.broadcastData(testMessage, {
            contentSize: 1024,
            headerSize: 1024,
            type: IpcPacketType.ArrayWithSize,
            buffers: [],
        });
        expect(result).to.be.false;
    });
});

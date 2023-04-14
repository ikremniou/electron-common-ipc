import { IpcBusCommandKind, IpcBusProcessType } from '@electron-common-ipc/universal';
import { expect } from 'chai';
import { IpcPacketType } from 'socket-serializer';
import { stubInterface } from 'ts-sinon';

import { IpcBusTransportSocketBridge } from '../../src/main/IpcBusSocketBridge';

import type { IpcBusBridgeImpl } from '../../src/main/IpcBusBridgeImpl';
import type {
    IpcBusConnector,
    IpcBusMessage,
    IpcBusPeer,
    Logger,
    MessageStamp,
    UuidProvider,
} from '@electron-common-ipc/universal';
import type { StubbedInstance } from 'ts-sinon';

describe('IpcBusTransportSocketBridge', () => {
    let connector: StubbedInstance<IpcBusConnector>;
    let uuidProvider: StubbedInstance<UuidProvider>;
    let ipcBusBridge: StubbedInstance<IpcBusBridgeImpl>;
    let stamp: StubbedInstance<MessageStamp>;
    let logger: StubbedInstance<Logger>;

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

    function createSocketBridge(): IpcBusTransportSocketBridge {
        connector = stubInterface<IpcBusConnector>();
        uuidProvider = stubInterface<UuidProvider>();
        ipcBusBridge = stubInterface<IpcBusBridgeImpl>();
        stamp = stubInterface<MessageStamp>();
        logger = stubInterface<Logger>();

        const socketBridge = new IpcBusTransportSocketBridge(connector, ipcBusBridge, uuidProvider, stamp, logger);
        socketBridge.connect()
    }

    it('should create instance of the socket bridge', () => {
        const socketBridge = createSocketBridge();
        expect(socketBridge).to.exist;
    });

    it('should broadcast the args data to connector', () => {
        const socketBridge = createSocketBridge();
        const result = socketBridge.broadcastData(testMessage, ['args']);
        expect(result).to.be.false;
    });

    it('should broadcast the raw data to connector', () => {
        const socketBridge = createSocketBridge();
        const result = socketBridge.broadcastData(testMessage, {
            contentSize: 1024,
            headerSize: 1024,
            type: IpcPacketType.ArrayWithSize,
            buffers: [],
        });
        expect(result).to.be.false;
    });
});

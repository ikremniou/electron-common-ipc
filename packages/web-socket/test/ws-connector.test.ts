import { IpcBusCommandKind, IpcBusProcessType } from '@electron-common-ipc/universal';
import { expect } from 'chai';
import { JSONParserV1 } from 'json-helpers';
import * as sinon from 'sinon';
import { IpcPacketBuffer } from 'socket-serializer';
import * as tsSinon from 'ts-sinon';
import * as wsLib from 'ws';

import { WsConnector } from '../src/client/ws-connector';

import type {
    ClientConnectOptions,
    IpcBusConnectorClient,
    IpcBusMessage,
    IpcBusCommand,
    IpcBusPeer,
} from '@electron-common-ipc/universal';

describe('ws-connector unit tests', () => {
    let connector: WsConnector;
    let uuidProviderStub: sinon.SinonSpy;
    const testPeer: IpcBusPeer = {
        id: 'uuid',
        type: IpcBusProcessType.Node
    };

    beforeEach(() => {
        uuidProviderStub = sinon.spy(() => 'uuid');
        connector = new WsConnector(uuidProviderStub, JSONParserV1, IpcBusProcessType.Node);
    });

    it('should call uuid provider to generate connector id', () => {
        expect(uuidProviderStub.calledOnce).to.be.true;
    });

    it('should be created and create type should be node', () => {
        expect(connector.type).to.be.equal(IpcBusProcessType.Node);
    });

    it('should not throw in performing shutdown before connection', async () => {
        await expect(connector.shutdown()).to.eventually.fulfilled;
    });

    describe('handshake cases', () => {
        let ipcBusClientStub: tsSinon.StubbedInstance<IpcBusConnectorClient>;
        let stubbedWebSocket: tsSinon.StubbedInstance<wsLib.WebSocket>;
        let sandbox: sinon.SinonSandbox;
        const connectOptions: ClientConnectOptions = { port: 3000, timeoutDelay: 1000 };

        beforeEach(() => {
            sinon.createSandbox();
            ipcBusClientStub = tsSinon.stubInterface<IpcBusConnectorClient>();
            stubbedWebSocket = tsSinon.stubInterface<wsLib.WebSocket>();
            sandbox = sinon.createSandbox();
            sandbox.stub(wsLib, 'WebSocket').callsFake(() => {
                return stubbedWebSocket;
            });
        });

        afterEach(() => {
            sandbox.restore();
        });

        it('should handle handshake correctly', async () => {
            stubbedWebSocket.on.callsFake((event, listener) => {
                if (event === 'open') {
                    setTimeout(() => {
                        (listener as Function)();
                    });
                }
                return this;
            });

            const handshake = await connector.handshake(ipcBusClientStub, testPeer, connectOptions);

            expect(handshake.peer.id).to.be.equal('uuid');
            expect(handshake.logLevel).to.be.undefined;
            expect(handshake.peer.type).to.be.equal(IpcBusProcessType.Node);
        });

        it('should fire a timeout when handshake timeout is reached', async () => {
            const optionsCopy = { ...connectOptions };
            optionsCopy.timeoutDelay = 20;
            await expect(connector.handshake(ipcBusClientStub, testPeer, optionsCopy)).to.be.rejected;
        });

        it('should handle socket close on handshake correctly', async () => {
            stubbedWebSocket.on.callsFake((event, listener) => {
                if (event === 'close') {
                    setTimeout(() => {
                        (listener as Function)('close-code');
                    });
                }
                return this;
            });

            await expect(connector.handshake(ipcBusClientStub, testPeer, connectOptions)).to.be.rejected;
        });

        it('should handle socket error on handshake correctly', async () => {
            stubbedWebSocket.on.callsFake((event, listener) => {
                if (event === 'error') {
                    setTimeout(() => {
                        (listener as Function)('some-error');
                    });
                }
                return this;
            });

            await expect(connector.handshake(ipcBusClientStub, testPeer, connectOptions)).to.be.rejected;
        });

        describe('after handshake tests', () => {
            let closeHandler: Function;
            let errorHandler: Function;
            let messageHandler: Function;

            beforeEach(async () => {
                stubbedWebSocket.on.callsFake((event, listener) => {
                    switch (event) {
                        case 'open':
                            setTimeout(() => (listener as Function)());
                            break;
                        case 'close':
                            closeHandler = listener as Function;
                            break;
                        case 'error':
                            errorHandler = listener as Function;
                            break;
                        case 'message':
                            messageHandler = listener as Function;
                            break;
                    }
                    return this;
                });

                await connector.handshake(ipcBusClientStub, testPeer, connectOptions);
            });

            it('should perform shutdown correctly', async () => {
                stubbedWebSocket.on.callsFake((event, listener) => {
                    if (event === 'close') {
                        setTimeout(() => {
                            (listener as Function)();
                        });
                    }
                    return this;
                });

                await expect(connector.shutdown()).to.be.eventually.fulfilled;
                expect(stubbedWebSocket.close.calledOnce).to.be.true;
            });

            it('should timeout the shutdown in case timeout delay is reached', async () => {
                const shutdownOptions = { timeoutDelay: 20 };
                await expect(connector.shutdown(shutdownOptions)).to.be.eventually.rejected;
            });

            it('should handle socket close after handshake correctly', () => {
                closeHandler('close-event');
                expect(stubbedWebSocket.off.calledThrice).to.be.true;
                expect(() => connector.postCommand({} as IpcBusCommand)).to.throw();
                expect(() => connector.postMessage({} as IpcBusMessage)).to.throw();
            });

            it('should handle socket error after handshake correctly', () => {
                errorHandler('error');
                expect(stubbedWebSocket.off.calledThrice).to.be.true;
                expect(() => connector.postCommand({} as IpcBusCommand)).to.throw();
                expect(() => connector.postMessage({} as IpcBusMessage)).to.throw();
            });

            it('should handle socket data event and call onConnectorCommandBase', () => {
                const fakeCommand: IpcBusMessage = {
                    peer: {} as IpcBusPeer,
                    channel: 'test',
                    kind: IpcBusCommandKind.SendMessage,
                };

                const packetOut = new IpcPacketBuffer();
                packetOut.JSON = JSONParserV1;
                fakeCommand.isRawData = true;
                JSONParserV1.install();
                packetOut.serialize([fakeCommand]);
                JSONParserV1.uninstall();
                packetOut.buffers.forEach((buffer) => {
                    messageHandler(buffer);
                });

                sinon.assert.calledWithMatch(
                    ipcBusClientStub.onConnectorCommandBase.firstCall as never,
                    sinon.match.has('channel', 'test'),
                    sinon.match.any
                );
            });

            it('should postCommand after handshake', () => {
                connector.postCommand({ kind: IpcBusCommandKind.AddChannelListener, peer: testPeer });
                expect(stubbedWebSocket.send.called).to.be.true;
            });

            it('should postMessage after handshake', () => {
                connector.postMessage({
                    peer: {} as IpcBusPeer,
                    channel: 'channel',
                    kind: IpcBusCommandKind.SendMessage,
                });
                expect(stubbedWebSocket.send.called).to.be.true;
            });
        });
    });
});

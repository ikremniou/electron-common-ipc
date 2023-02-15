import { IpcBusCommandKind, IpcBusProcessType } from '@electron-common-ipc/universal';
import { expect } from 'chai';
import { JSONParserV1 } from 'json-helpers';
import * as sinon from 'sinon';
import { IpcPacketBuffer } from 'socket-serializer-ik';
import * as tsSinon from 'ts-sinon';

import { WsBrowserConnector } from '../lib/ws-browser-connector';

import type {
    IpcBusMessage,
    Logger,
    IpcBusConnectorClient,
    ClientConnectOptions,
    IpcBusCommand,
} from '@electron-common-ipc/universal';
import type { IpcBusPeer } from '@electron-common-ipc/universal/lib/contract/ipc-bus-peer';

describe('ws-browser-connector unit tests', () => {
    let connector: WsBrowserConnector;
    let uuidProviderStub: sinon.SinonSpy;

    beforeEach(() => {
        const loggerStub = tsSinon.stubInterface<Logger>();
        uuidProviderStub = sinon.spy(() => 'uuid');
        connector = new WsBrowserConnector(uuidProviderStub, IpcBusProcessType.Browser, loggerStub);
    });

    it('should call uuid provider to generate peer id', () => {
        expect(uuidProviderStub.calledOnce).to.be.true;
        expect(connector.peer.id).to.be.equal('uuid');
    });

    it('should not throw in performing shutdown before connection', async () => {
        await expect(connector.shutdown()).to.eventually.fulfilled;
    });

    it('should correctly identify target by the peer id', () => {
        expect(connector.isTarget({ peer: { id: 'uuid' } } as IpcBusMessage));
    });

    describe('handshake cases', () => {
        let ipcBusClientStub: tsSinon.StubbedInstance<IpcBusConnectorClient>;
        let stubbedWebSocket: tsSinon.StubbedInstance<WebSocket>;
        const connectOptions: ClientConnectOptions = { port: 3000, timeoutDelay: 1000 };
        beforeEach(() => {
            ipcBusClientStub = tsSinon.stubInterface<IpcBusConnectorClient>();
            stubbedWebSocket = tsSinon.stubInterface<WebSocket>();

            class WsStubConstructor {}
            global.WebSocket = WsStubConstructor as never;
            sinon.stub(global, 'WebSocket').callsFake(() => stubbedWebSocket);
        });

        it('should handle handshake correctly', async () => {
            stubbedWebSocket.addEventListener.callsFake((event, listener) => {
                if (event === 'open') {
                    setTimeout(() => {
                        (listener as Function)();
                    });
                }
            });

            const handshake = await connector.handshake(ipcBusClientStub, connectOptions);

            expect(handshake.peer.id).to.be.equal('uuid');
            expect(handshake.logLevel).to.be.undefined;
            expect(handshake.peer.type).to.be.equal(IpcBusProcessType.Browser);
        });

        it('should fire a timeout when handshake timeout is reached', async () => {
            connectOptions.timeoutDelay = 20;
            await expect(connector.handshake(ipcBusClientStub, connectOptions)).to.be.rejected;
        });

        it('should handle socket close on handshake correctly', async () => {
            stubbedWebSocket.addEventListener.callsFake((event, listener) => {
                if (event === 'close') {
                    setTimeout(() => {
                        (listener as Function)('close-code');
                    });
                }
            });

            await expect(connector.handshake(ipcBusClientStub, connectOptions)).to.be.rejected;
        });

        it('should handle socket error on handshake correctly', async () => {
            stubbedWebSocket.addEventListener.callsFake((event, listener) => {
                if (event === 'error') {
                    setTimeout(() => {
                        (listener as Function)('some-error');
                    });
                }
            });

            await expect(connector.handshake(ipcBusClientStub, connectOptions)).to.be.rejected;
        });

        describe('after handshake tests', () => {
            let closeHandler: Function;
            let errorHandler: Function;
            let messageHandler: Function;

            beforeEach(async () => {
                stubbedWebSocket.addEventListener.callsFake((event, listener) => {
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
                });

                await connector.handshake(ipcBusClientStub, connectOptions);
            });

            it('should perform shutdown correctly', async () => {
                stubbedWebSocket.addEventListener.callsFake((event, listener) => {
                    if (event === 'close') {
                        setTimeout(() => {
                            (listener as Function)();
                        });
                    }
                });
                await expect(connector.shutdown()).to.be.eventually.fulfilled;
                expect(stubbedWebSocket.close.calledOnce).to.be.true;
            });

            it('should timeout the shutdown in case timeout delay is reached', async () => {
                const shutdownOptions = { timeoutDelay: 20 };
                await expect(connector.shutdown(shutdownOptions)).to.be.eventually.rejected;
            });

            it('should handle socket close after handshake correctly', () => {
                stubbedWebSocket.removeEventListener.resetHistory();
                closeHandler('close-event');
                expect(stubbedWebSocket.removeEventListener.calledThrice).to.be.true;
                expect(() => connector.postCommand({} as IpcBusCommand)).to.throw();
                expect(() => connector.postMessage({} as IpcBusMessage)).to.throw();
            });

            it('should handle socket error after handshake correctly', () => {
                stubbedWebSocket.removeEventListener.resetHistory();
                errorHandler('error');
                expect(stubbedWebSocket.removeEventListener.calledThrice).to.be.true;
                expect(() => connector.postCommand({} as IpcBusCommand)).to.throw();
                expect(() => connector.postMessage({} as IpcBusMessage)).to.throw();
            });

            it('should handle socket data event and call onConnectorCommandBase', () => {
                const fakeCommand: IpcBusMessage = {
                    peer: {} as IpcBusPeer,
                    channel: 'test',
                    kind: IpcBusCommandKind.SendMessage,
                    isRawData: true,
                };

                const packetOut = new IpcPacketBuffer();
                packetOut.JSON = JSONParserV1;
                JSONParserV1.install();
                packetOut.serialize([fakeCommand]);
                JSONParserV1.uninstall();
                packetOut.buffers.forEach((buffer) => {
                    messageHandler({ data: buffer });
                });

                sinon.assert.calledWithMatch(
                    ipcBusClientStub.onConnectorCommandBase.firstCall as never,
                    sinon.match.has('channel', 'test'),
                    sinon.match.any
                );
            });

            it('should postCommand after handshake', () => {
                connector.postCommand({ kind: IpcBusCommandKind.AddChannelListener });
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

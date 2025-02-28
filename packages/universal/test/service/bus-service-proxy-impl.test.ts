import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';

import { IpcBusClientImpl } from '../../src/client/bus-client-impl';
import { IpcBusServiceProxyImpl } from '../../src/service/bus-service-proxy-impl';
import { ServiceConstants } from '../../src/service/constants';
import { getServiceCallChannel, getServiceEventChannel } from '../../src/service/utilities';

import type { IpcBusEvent, IpcBusRequestResponse } from '../../src/client/bus-client';
import type { IpcBusPeer } from '../../src/contract/ipc-bus-peer';
import type { IpcBusServiceProxy } from '../../src/service/bus-service-proxy';

describe('ipc-bus-service-proxy-impl', () => {
    let ipcBusClientMock: sinon.SinonStubbedInstance<IpcBusClientImpl>;
    let ipcBusServiceProxy: IpcBusServiceProxy;
    let eventEmitter: EventEmitter;
    const commonServiceName = 'service-1';

    beforeEach(() => {
        ipcBusClientMock = sinon.createStubInstance(IpcBusClientImpl);
        eventEmitter = new EventEmitter();
        ipcBusServiceProxy = new IpcBusServiceProxyImpl(ipcBusClientMock, commonServiceName, eventEmitter, {
            timeoutDelay: 3333,
        });
    });

    it('should release the subscription if remote service is not started', async () => {
        ipcBusClientMock.requestTo.resolves({} as IpcBusRequestResponse);

        await expect(ipcBusServiceProxy.connect()).to.be.eventually.rejected;
        await ipcBusServiceProxy.close();

        const eventName = getServiceEventChannel(commonServiceName);
        sinon.assert.calledOnceWithExactly(ipcBusClientMock.addListener, eventName, sinon.match.any);
        sinon.assert.calledOnceWithExactly(ipcBusClientMock.removeListener, eventName, sinon.match.any);
    });

    it('should call request on the client ', async () => {
        ipcBusClientMock.requestTo.resolves({} as IpcBusRequestResponse).calledOnce;

        await expect(ipcBusServiceProxy.connect()).to.be.eventually.rejected;
    });

    it('should reject connect if request failed', async () => {
        ipcBusClientMock.requestTo.rejects({ err: 'error' });
        await expect(ipcBusServiceProxy.connect()).to.be.rejectedWith('error');
    });

    it('should have connection timeout from the constructor if none is passed to connect', async () => {
        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();

        expect(ipcBusClientMock.requestTo.calledWith(sinon.match.any, sinon.match.any, 3333)).to.be.true;
    });

    it('should have connection timeout from the connect function when it is passed', async () => {
        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect({ timeoutDelay: 2222 });

        expect(ipcBusClientMock.requestTo.calledWith(sinon.match.any, sinon.match.any, 2222)).to.be.true;
    });

    it('should successfully open connection after if was closed', async () => {
        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();
        await ipcBusServiceProxy.close();
        await ipcBusServiceProxy.connect();

        expect(ipcBusServiceProxy.isStarted).to.be.true;
        sinon.assert.calledTwice(ipcBusClientMock.requestTo);
    });

    it('should not have any effect if close was called before connect', async () => {
        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);
        await ipcBusServiceProxy.close();
        await ipcBusServiceProxy.connect();
        expect(ipcBusServiceProxy.isStarted).to.be.true;
        sinon.assert.calledOnce(ipcBusClientMock.requestTo);
    });

    it('should return "false" when calling isStarted after close', async () => {
        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);
        await ipcBusServiceProxy.connect();
        await ipcBusServiceProxy.close();
        expect(ipcBusServiceProxy.isStarted).to.be.false;
    });

    it('should emit start event when services is connected', async () => {
        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);
        const emitSpy = sinon.spy(eventEmitter.emit);
        eventEmitter.emit = emitSpy;

        await ipcBusServiceProxy.connect();
        sinon.assert.calledOnceWithExactly(emitSpy, ServiceConstants.IPCBUS_SERVICE_EVENT_START, sinon.match.any);
    });

    it('should emit stop event if stopped explicitly', async () => {
        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);
        const emitSpy = sinon.spy(eventEmitter.emit);
        eventEmitter.emit = emitSpy;
        await ipcBusServiceProxy.connect();
        await ipcBusServiceProxy.close();
        expect(emitSpy.lastCall.firstArg).to.be.equal(ServiceConstants.IPCBUS_SERVICE_EVENT_STOP);
    });

    it('should have a valid emitter wrapper object after the creation', () => {
        expect(ipcBusServiceProxy.wrapper).to.exist;
        expect(ipcBusServiceProxy.getWrapper<EventEmitter>()).to.be.instanceOf(EventEmitter);
    });

    it('should report service status correctly when connected and stopped', async () => {
        ipcBusClientMock.requestTo.resolves({
            payload: { started: true, supportEventEmitter: true, callHandlers: [] },
        } as IpcBusRequestResponse);
        let serviceStatus = await ipcBusServiceProxy.getStatus();
        expect(serviceStatus.started).to.be.true;
        expect(serviceStatus.supportEventEmitter).to.be.true;
        expect(serviceStatus.callHandlers).to.be.deep.eq([]);

        ipcBusClientMock.requestTo.resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);
        await ipcBusServiceProxy.connect();

        ipcBusClientMock.requestTo.resolves({
            payload: { started: true, supportEventEmitter: true, callHandlers: [] },
        } as IpcBusRequestResponse);
        serviceStatus = await ipcBusServiceProxy.getStatus();
        expect(serviceStatus.started).to.be.true;
        expect(serviceStatus.supportEventEmitter).to.be.true;
        expect(serviceStatus.callHandlers).to.be.deep.eq([]);
    });

    describe('should call/requestCall service method with passed arguments', () => {
        const methods: ('call' | 'requestCall')[] = ['call', 'requestCall'];

        methods.forEach((method) => {
            it(`should ${method}`, async () => {
                const firstCallPromise = ipcBusServiceProxy[method]('do1', 'arg1', 'arg2');
                ipcBusClientMock.requestTo
                    .onFirstCall()
                    .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);
                ipcBusClientMock.requestTo.onSecondCall().resolves({ payload: 'data_1' } as IpcBusRequestResponse);
                ipcBusClientMock.requestTo.onThirdCall().resolves({ payload: 'data_2' } as IpcBusRequestResponse);

                await ipcBusServiceProxy.connect();

                const secondCallResult = await ipcBusServiceProxy.call('do2', 'arg1', 'arg2');
                const firstCallResult = await firstCallPromise;

                expect(secondCallResult).to.be.equal('data_2');
                expect(firstCallResult).to.be.equal('data_1');

                const callChannel = getServiceCallChannel(commonServiceName);
                sinon.assert.calledWith(
                    ipcBusClientMock.requestTo.secondCall,
                    sinon.match.any,
                    callChannel,
                    sinon.match.any,
                    {
                        handlerName: 'do1',
                        args: ['arg1', 'arg2'],
                    }
                );
                sinon.assert.calledWith(
                    ipcBusClientMock.requestTo.thirdCall,
                    sinon.match.any,
                    callChannel,
                    sinon.match.any,
                    {
                        handlerName: 'do2',
                        args: ['arg1', 'arg2'],
                    }
                );
            });
        });
    });

    describe('should apply/requestApply service method with passed arguments', () => {
        const methods: ('apply' | 'requestApply')[] = ['apply', 'requestApply'];

        methods.forEach((method) => {
            it(`should ${method}`, async () => {
                const firstCallPromise = ipcBusServiceProxy[method]('do1', ['arg1', 'arg2']);
                ipcBusClientMock.requestTo
                    .onFirstCall()
                    .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);
                ipcBusClientMock.requestTo.onSecondCall().resolves({ payload: 'data_1' } as IpcBusRequestResponse);
                ipcBusClientMock.requestTo.onThirdCall().resolves({ payload: 'data_2' } as IpcBusRequestResponse);

                await ipcBusServiceProxy.connect();

                const secondCallResult = await ipcBusServiceProxy[method]('do2', ['arg1', 'arg2']);
                const firstCallResult = await firstCallPromise;

                expect(secondCallResult).to.be.equal('data_2');
                expect(firstCallResult).to.be.equal('data_1');

                const callChannel = getServiceCallChannel(commonServiceName);
                sinon.assert.calledWith(
                    ipcBusClientMock.requestTo.secondCall,
                    sinon.match.any,
                    callChannel,
                    sinon.match.any,
                    {
                        handlerName: 'do1',
                        args: ['arg1', 'arg2'],
                    }
                );
                sinon.assert.calledWith(
                    ipcBusClientMock.requestTo.thirdCall,
                    sinon.match.any,
                    callChannel,
                    sinon.match.any,
                    {
                        handlerName: 'do2',
                        args: ['arg1', 'arg2'],
                    }
                );
            });
        });
    });

    it('should sendCall to the service with passed arguments', async () => {
        const firstCallResult = ipcBusServiceProxy.sendCall('do1', 'arg1', 'arg2');
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();

        const secondCallResult = ipcBusServiceProxy.sendCall('do2', 'arg1', 'arg2');

        expect(secondCallResult).to.be.equal(undefined);
        expect(firstCallResult).to.be.equal(undefined);

        const callChannel = getServiceCallChannel(commonServiceName);
        sinon.assert.calledWith(ipcBusClientMock.sendTo.firstCall, sinon.match.any, callChannel, {
            handlerName: 'do1',
            args: ['arg1', 'arg2'],
        });
        sinon.assert.calledWith(ipcBusClientMock.sendTo.secondCall, sinon.match.any, callChannel, {
            handlerName: 'do2',
            args: ['arg1', 'arg2'],
        });
    });

    it('should sendApply to the service with passed arguments', async () => {
        const firstCallResult = ipcBusServiceProxy.sendApply('do1', ['arg1', 'arg2']);
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();

        const secondCallResult = ipcBusServiceProxy.sendApply('do2', ['arg1', 'arg2']);

        expect(secondCallResult).to.be.equal(undefined);
        expect(firstCallResult).to.be.equal(undefined);

        const callChannel = getServiceCallChannel(commonServiceName);
        sinon.assert.calledWith(ipcBusClientMock.sendTo.firstCall, sinon.match.any, callChannel, {
            handlerName: 'do1',
            args: ['arg1', 'arg2'],
        });
        sinon.assert.calledWith(ipcBusClientMock.sendTo.secondCall, sinon.match.any, callChannel, {
            handlerName: 'do2',
            args: ['arg1', 'arg2'],
        });
    });

    it('should update wrapper with request, send, and handler', async () => {
        const methods = ['superMethod1', 'superMethod2'];
        const resultMethods: { method: string; res: unknown; type: string }[] = [];
        methods.forEach((method) => {
            resultMethods.push({ method, res: 'data_1', type: 'request' });
            resultMethods.push({ method: `request_${method}`, res: 'data_2', type: 'request' });
            resultMethods.push({ method: `send_${method}`, res: undefined, type: 'send' });
        });

        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: methods } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();

        const callChannel = getServiceCallChannel(commonServiceName);
        const wrapper: Record<string, Function> = ipcBusServiceProxy.getWrapper();

        for (const data of resultMethods) {
            if (data.type === 'request') {
                ipcBusClientMock.requestTo.resolves({ payload: data.res } as IpcBusRequestResponse);
            } else if (data.type === 'send') {
                ipcBusClientMock.sendTo.resolves({ payload: data.res } as IpcBusRequestResponse);
            }

            const realResult = await wrapper[data.method]('test_arg');
            expect(realResult).to.be.equal(data.res);

            if (data.type === 'request') {
                sinon.assert.calledWith(
                    ipcBusClientMock.requestTo.lastCall,
                    sinon.match.any,
                    callChannel,
                    sinon.match.any,
                    {
                        handlerName: data.method.split('_').pop(),
                        args: ['test_arg'],
                    }
                );
            } else if (data.type === 'send') {
                sinon.assert.calledWith(ipcBusClientMock.sendTo.lastCall, sinon.match.any, callChannel, {
                    handlerName: data.method.split('_').pop(),
                    args: ['test_arg'],
                });
            }
        }
    });

    it('should emit event on wrapper when service event received', async () => {
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();

        let eventWasCalled = false;
        const wrapper: EventEmitter = ipcBusServiceProxy.getWrapper();
        wrapper.on('my_event', () => {
            eventWasCalled = true;
        });

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: ServiceConstants.IPCBUS_SERVICE_WRAPPER_EVENT,
            args: ['my_event', ['arg1', 'arg2']],
        });

        expect(eventWasCalled).to.be.equal(true);
    });

    it('should emit unknown even from the service', async () => {
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();

        const emitSpy = sinon.spy(eventEmitter.emit);
        eventEmitter.emit = emitSpy;

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: 'my_event',
            args: ['my_arg'],
        });

        sinon.assert.calledWith(emitSpy, 'my_event', 'my_arg');
    });

    it('should handle start event from service', async () => {
        ipcBusClientMock.requestTo.onFirstCall().resolves({} as IpcBusRequestResponse);

        await expect(ipcBusServiceProxy.connect()).to.be.eventually.rejected;

        const emitSpy = sinon.spy(eventEmitter.emit);
        eventEmitter.emit = emitSpy;

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: ServiceConstants.IPCBUS_SERVICE_EVENT_START,
            args: [{ started: true, callHandlers: [] }],
        });

        sinon.assert.calledWith(emitSpy, ServiceConstants.IPCBUS_SERVICE_EVENT_START);
    });

    it('should handle close event from service', async () => {
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await ipcBusServiceProxy.connect();

        const emitSpy = sinon.spy(eventEmitter.emit);
        eventEmitter.emit = emitSpy;

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: ServiceConstants.IPCBUS_SERVICE_EVENT_STOP,
            args: [{ started: true, callHandlers: [] }],
        });

        sinon.assert.calledWith(emitSpy, ServiceConstants.IPCBUS_SERVICE_EVENT_STOP);
    });

    it('should not send service stop and start event when emitter is not provided', async () => {
        const proxyWithoutEmitter = new IpcBusServiceProxyImpl(ipcBusClientMock, 'service');
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await proxyWithoutEmitter.connect();

        const emitSpy = sinon.spy(ipcBusServiceProxy.emit);
        ipcBusServiceProxy.emit = emitSpy;

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: ServiceConstants.IPCBUS_SERVICE_EVENT_STOP,
            args: [{ started: true, callHandlers: [] }],
        });

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: ServiceConstants.IPCBUS_SERVICE_EVENT_START,
            args: [{ started: true, callHandlers: [] }],
        });

        sinon.assert.neverCalledWith(emitSpy);
    });

    it('should should handler service start and stop events without emitter', async () => {
        const proxyWithoutEmitter = new IpcBusServiceProxyImpl(ipcBusClientMock, 'service');
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await proxyWithoutEmitter.connect();

        expect(() => {
            ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
                eventName: ServiceConstants.IPCBUS_SERVICE_EVENT_START,
                args: [{ started: true, callHandlers: [] }],
            });

            ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
                eventName: ServiceConstants.IPCBUS_SERVICE_EVENT_STOP,
                args: [{ started: true, callHandlers: [] }],
            });
        }).to.not.throw();
    });

    it('should throw error when trying to emit arbitrary event without emitter', async () => {
        const proxyWithoutEmitter = new IpcBusServiceProxyImpl(ipcBusClientMock, 'service');
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await proxyWithoutEmitter.connect();
        expect(() =>
            ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
                eventName: 'some_event',
                args: ['my_arg'],
            })
        ).to.throw();
    });

    it('should throw error when trying to emit service event without emitter', async () => {
        const proxyWithoutEmitter = new IpcBusServiceProxyImpl(ipcBusClientMock, 'service');
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await proxyWithoutEmitter.connect();
        expect(() =>
            ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
                eventName: ServiceConstants.IPCBUS_SERVICE_WRAPPER_EVENT,
                args: ['event', 'my_arg'],
            })
        ).to.throw();
    });

    it('should emit service event 2 times on service and on emitter', async () => {
        const eventEmitter = new EventEmitter();
        const emitSpy = sinon.spy(eventEmitter.emit);
        eventEmitter.emit = emitSpy;
        const proxy = new IpcBusServiceProxyImpl(ipcBusClientMock, 'service', eventEmitter);
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        await proxy.connect();

        emitSpy.resetHistory();

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: ServiceConstants.IPCBUS_SERVICE_WRAPPER_EVENT,
            args: ['my_event', ['arg1', 'arg2']],
        });

        sinon.assert.calledOnceWithExactly(emitSpy, 'my_event', 'arg1', 'arg2');
    });

    it('should not trigger the IpcBusClient if service in not connected', () => {
        const proxy = new IpcBusServiceProxyImpl(ipcBusClientMock, 'some-service', eventEmitter);
        proxy.requestApply('some-method', ['1', 2, 3]);

        expect(ipcBusClientMock.requestTo.notCalled).to.be.true;
    });

    it('should resolve connect promise if service status received as an event after', async () => {
        const proxy = new IpcBusServiceProxyImpl(ipcBusClientMock, 'some-service', eventEmitter);
        ipcBusClientMock.requestTo.onFirstCall().returns(new Promise<IpcBusRequestResponse>(() => {}));
        ipcBusClientMock.requestTo
            .onSecondCall()
            .resolves({ payload: { started: true, callHandlers: [] } } as IpcBusRequestResponse);

        const promise = proxy.connect();
        await new Promise<void>((resolve) => setTimeout(resolve));

        ipcBusClientMock.addListener.firstCall.args[1]({} as IpcBusEvent, {
            eventName: ServiceConstants.IPCBUS_SERVICE_EVENT_START,
            args: [{ started: true, callHandlers: [] }],
        });

        await expect(promise).to.be.eventually.fulfilled;
    });

    it('should pass target to the request function when service support direct communication', async () => {
        const proxy = new IpcBusServiceProxyImpl(ipcBusClientMock, 'some-service', eventEmitter);
        const sender = {} as IpcBusPeer;
        const event: IpcBusEvent = { channel: 'test-channel', sender };
        ipcBusClientMock.requestTo
            .onFirstCall()
            .resolves({ payload: { started: true, callHandlers: [], direct: true }, event } as IpcBusRequestResponse);
        await proxy.connect();

        ipcBusClientMock.requestTo.onSecondCall().resolves({ payload: 'data' } as IpcBusRequestResponse);
        const result = await proxy.requestApply('some', [1, '2', 3]);

        expect(result).to.be.eq('data');
        expect(ipcBusClientMock.requestTo.secondCall.args[0]).to.be.eq(sender);
    });
});

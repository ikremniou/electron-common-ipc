import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import * as tsSinon from 'ts-sinon';

import { IpcBusServiceImpl } from '../../lib/service/bus-service-impl';
import { ServiceConstants } from '../../lib/service/constants';
import { getServiceCallChannel, getServiceEventChannel } from '../../lib/service/utilities';
import { createFakeIpcBusEvent } from '../test-utils/event';

import type { IpcBusClient, IpcBusEvent } from '../../lib/client/bus-client';
import type { Logger } from '../../lib/log/logger';
import type { IpcBusServiceCall } from '../../lib/service/bus-service';

describe('bus-service-proxy-impl', () => {
    class TestServiceClass extends EventEmitter {
        constructor() {
            super();
        }

        testMethod1(): void {}
        testMethod2(_arg: string): void {}
        _privateMethod(): void {}
    }

    const serviceName = 'test_service';
    let service: IpcBusServiceImpl;
    let noEmitterService: IpcBusServiceImpl;
    let stubbedInstance: sinon.SinonStubbedInstance<TestServiceClass>;
    let stubbedClient: tsSinon.StubbedInstance<IpcBusClient>;

    beforeEach(() => {
        stubbedClient = tsSinon.stubInterface<IpcBusClient>();
        stubbedInstance = sinon.createStubInstance(TestServiceClass);
        const stubbedLogger = tsSinon.stubInterface<Logger>();

        service = new IpcBusServiceImpl(
            stubbedClient,
            serviceName,
            stubbedInstance,
            EventEmitter.prototype,
            stubbedLogger
        );

        noEmitterService = new IpcBusServiceImpl(stubbedClient, serviceName, stubbedInstance);
    });

    it('should be able to start to establish connection', () => {
        expect(() => service.start()).not.to.throw();
    });

    it('should be able to replace original emit function with event handler', () => {
        const originalEmit = stubbedInstance.emit;
        service.start();
        expect(originalEmit).to.not.be.equal(stubbedInstance.emit);
    });

    it('should be able to send start event when start is called', () => {
        service.start();
        sinon.assert.calledOnceWithMatch(
            stubbedClient.send as never,
            getServiceEventChannel(serviceName),
            sinon.match.has('eventName', ServiceConstants.IPCBUS_SERVICE_EVENT_START)
        );

        sinon.assert.calledOnceWithMatch(
            stubbedClient.addListener as never,
            getServiceCallChannel(serviceName),
            sinon.match.any
        );
    });

    it('should not throw if stopping not started service', () => {
        expect(() => service.stop()).to.not.throw();
        expect(() => noEmitterService.stop()).to.not.throw();
    });

    it('should be able to stop and send close event correctly', () => {
        service.start();

        service.stop();
        sinon.assert.calledWithMatch(
            stubbedClient.send.lastCall as never,
            getServiceEventChannel(serviceName),
            sinon.match.has('eventName', ServiceConstants.IPCBUS_SERVICE_EVENT_STOP)
        );

        sinon.assert.calledWithMatch(
            stubbedClient.removeListener.lastCall as never,
            getServiceCallChannel(serviceName),
            sinon.match.any
        );
    });

    it('should be able to restore original event emitter function on close', () => {
        const originalEmit = stubbedInstance.emit;
        service.start();
        service.stop();
        expect(originalEmit).to.be.equal(stubbedInstance.emit);
    });

    it('should be able to register all call handlers on the passed instance', () => {
        service.start();
        const serviceCall: IpcBusServiceCall = { handlerName: stubbedInstance.testMethod1.name, args: [] };
        stubbedClient.addListener.lastCall.args[1]({} as IpcBusEvent, serviceCall);
        serviceCall.handlerName = stubbedInstance.testMethod2.name;
        serviceCall.args = ['my_arg'];
        stubbedClient.addListener.lastCall.args[1]({} as IpcBusEvent, serviceCall);

        sinon.assert.calledOnceWithExactly(stubbedInstance.testMethod1);
        sinon.assert.calledOnceWithMatch(stubbedInstance.testMethod2, 'my_arg');
    });

    describe('should throw when invalid method call received', () => {
        const throwCases = [
            ['EventEmitter methods', EventEmitter.prototype.addListener.name],
            ['private methods', TestServiceClass.prototype._privateMethod.name],
            ['unknown methods', 'unknown_method'],
        ];

        throwCases.forEach((value) => {
            it(`${value[0]} throw error`, () => {
                service.start();
                const serviceCall: IpcBusServiceCall = { handlerName: value[1], args: [] };
                const [, rejectSpy, event] = createFakeIpcBusEvent();
                stubbedClient.addListener.lastCall.args[1](event, serviceCall);
                sinon.assert.calledOnceWithMatch(rejectSpy, sinon.match.any);
            });
        });
    });

    it('should be able to send arbitrary events', () => {
        service.start();
        service.sendEvent('my_event', 'my_arg');
        sinon.assert.calledWithMatch(
            stubbedClient.send.lastCall as never,
            getServiceEventChannel(serviceName),
            sinon.match({ eventName: 'my_event', args: ['my_arg'] })
        );
    });

    it('should be able to register and unregister call handlers', () => {
        service.start();
        const handlerSpy = sinon.spy();
        service.registerCallHandler('my_handler', handlerSpy);
        const serviceCall: IpcBusServiceCall = { handlerName: 'my_handler', args: [] };
        stubbedClient.addListener.lastCall.args[1]({} as IpcBusEvent, serviceCall);
        sinon.assert.calledOnceWithExactly(handlerSpy);

        service.unregisterCallHandler('my_handler');
        const [, rejectSpy, event] = createFakeIpcBusEvent();
        stubbedClient.addListener.lastCall.args[1](event, serviceCall);
        sinon.assert.calledOnceWithMatch(rejectSpy, sinon.match.any);
    });

    it('should not cause the stack overflow if start called multiple times', () => {
        service.start();
        service.start();
        expect(() => stubbedInstance.emit('some-event', 'args')).to.not.throw();
    });
});

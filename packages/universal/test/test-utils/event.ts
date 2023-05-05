import * as sinon from 'sinon';

import type { IpcBusEvent } from '../../src/client/bus-client';
import type { IpcBusPeer } from '../../src/contract/ipc-bus-peer';

export function createFakeIpcBusEvent(): [sinon.SinonSpy, sinon.SinonSpy, IpcBusEvent] {
    const rejectFake = sinon.fake();
    const resolveFake = sinon.fake();
    const event: IpcBusEvent = {
        channel: 'test_channel',
        sender: { id: 'some_id' } as IpcBusPeer,
        request: {
            reject: rejectFake,
            resolve: resolveFake,
        },
    };

    return [resolveFake, rejectFake, event];
}

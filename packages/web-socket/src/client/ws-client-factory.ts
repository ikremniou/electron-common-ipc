import { GlobalContainer } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { JSONParserV1 } from 'json-helpers';

import { createWebSocketClient as createThin } from './ws-client-factory-thin';
import { uuidProvider } from '../uuid';

import type { ThinContext} from './ws-client-factory-thin';
import type { IpcBusClient } from '@electron-common-ipc/universal';

export function createWebSocketClient(ctx?: Partial<ThinContext>): IpcBusClient {
    const emitter = new EventEmitter();
    const container = new GlobalContainer();
    const defaultCtx = {
        emitter,
        uuidProvider,
        json: JSONParserV1,
        container,
    };
    const mergedCtx = ctx
        ? {
              ...defaultCtx,
              ...ctx,
          }
        : defaultCtx;
    return createThin(mergedCtx);
}

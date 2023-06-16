import { GlobalContainer } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { JSONParserV1 } from 'json-helpers';

import { uuidProvider } from './uuid';
import { createWebSocketClient as createThin } from './ws-browser-factory-thin';

import type { ThinContext } from './ws-browser-factory-thin';
import type { IpcBusClient } from '@electron-common-ipc/universal';

export function createWebSocketClient(ctx?: Partial<ThinContext>): IpcBusClient {
    const container = new GlobalContainer();
    const defaultCtx = {
        uuidProvider,
        emitter: new EventEmitter(),
        json: JSONParserV1,
        container: container,
    };
    const mergedCtx = ctx
        ? {
              ...defaultCtx,
              ...ctx,
          }
        : defaultCtx;
    return createThin(mergedCtx);
}

import * as util from 'util';

import type { IpcPacketBufferCore } from 'socket-serializer';

// See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
// see https://www.electronjs.org/docs/latest/breaking-changes#planned-breaking-api-changes-80
// see https://github.com/electron/electron/pull/20214
// To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer

/** @internal */
export function Uint8ArrayToBuffer(rawBuffer: Buffer | Uint8Array): Buffer {
    if (util.types.isUint8Array(rawBuffer)) {
        return Buffer.from(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength);
    }
    return rawBuffer;
}

/** @internal */
export function FixRawContent(rawData: IpcPacketBufferCore.RawData, forceSingleBuffer?: boolean) {
    if (rawData.buffer) {
        rawData.buffer = Uint8ArrayToBuffer(rawData.buffer);
    } else if (Array.isArray(rawData.buffers)) {
        rawData.buffers = rawData.buffers.map(Uint8ArrayToBuffer);
        // for (let i = 0, l = rawData.buffers.length; i < l; ++i) {
        //     rawData.buffers[i] = Uint8ArrayToBuffer(rawData.buffers[i]);
        // }
        if (forceSingleBuffer) {
            rawData.buffer = Buffer.concat(rawData.buffers);
            rawData.buffers = undefined;
        }
    }
}

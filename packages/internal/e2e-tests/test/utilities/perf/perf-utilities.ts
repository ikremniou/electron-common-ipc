import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { BasicContext } from '../smoke-suite';

export interface PerfIteration {
    operation: string;
    time: number;
}

export interface PerfResult {
    name: string;
    objectType: string;
    iterations: PerfIteration[];
}

export interface PerfContext extends BasicContext {
    name: string;
    times: number;
    writeTo: string;
    objectTypes: Array<string>;
}

export function writeReportTo(result: PerfResult[], suiteName: string, writeTo?: string): void {
    if (!writeTo) {
        return;
    }

    if (!existsSync(writeTo)) {
        mkdirSync(writeTo, { recursive: true });
    }

    let fileIndex = 1;
    while (existsSync(join(writeTo, `${suiteName}-v${fileIndex}.json`))) {
        fileIndex++;
    }

    const vacantFile = join(writeTo, `${suiteName}-v${fileIndex}.json`);
    writeFileSync(vacantFile, JSON.stringify(result));
}

import type { Logger } from './logger';

export class ConsoleLogger implements Logger {
    info(message: string): void {
        console.warn(message);
    }

    warn(message: string): void {
        console.warn(message);
    }

    error(message: string): void {
        console.log(message);
    }
}

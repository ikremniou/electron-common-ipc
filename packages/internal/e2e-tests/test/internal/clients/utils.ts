export function isLogEnabled(): boolean {
    return process.argv.some((x) => x === '--test-log');
}

export function createLogArgv(): string[] {
    if (isLogEnabled()) {
        return ['--test-log'];
    }
    return [];
}

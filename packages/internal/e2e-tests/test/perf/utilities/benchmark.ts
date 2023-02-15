import { performance } from 'perf_hooks';

export interface BenchmarkConfig {
    iterations: number;
}

export class Benchmark {
    constructor(private readonly config?: BenchmarkConfig) {}

    public async recordAsync(name: string, callable: CallableFunction): Promise<void> {
        const measures = new Array<number>();
        const config = this.config ?? { iterations: 1 };

        for (let i = 0; i < config.iterations; i++) {
            const now = performance.now();
            await callable();
            measures.push(performance.now() - now);
        }

        const average = measures.reduce((acc, measure) => acc + measure) / measures.length;
        const min = Math.min(...measures);
        const max = Math.max(...measures);

        console.log(`${name} | ${average} ms (+/- ${max - min} ms) from ${config.iterations} iterations`);
    }
}

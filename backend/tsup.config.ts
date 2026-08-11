import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'index.ts',
    'app.ts',
    'workers/event-consumer.ts',
    'workers/voice-worker.ts',
    'workers/compaction-worker.ts',
    'lambdas/event-handler.ts',
    'lambdas/voice-handler.ts',
    'body-service.ts',
    'energy-service.ts',
    'goals-service.ts',
  ],
  format: ['esm'],
  target: 'es2020',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  treeshake: false,
  splitting: false,
  dts: false,
  skipNodeModulesBundle: true,
  // Preserve module structure for Node ESM
  outExtension() {
    return { js: '.js' };
  },
});

import { defineConfig } from 'vitest/config';

// The backend entities use bare @Column() decorators whose types come from
// tsc's emitDecoratorMetadata. esbuild (vitest's transform) needs that flag
// passed explicitly, otherwise importing any entity throws
// ColumnTypeUndefinedError at test time.
export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});

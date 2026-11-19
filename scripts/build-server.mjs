import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

await rm('server/dist', { recursive: true, force: true });

await build({
  entryPoints: ['server/src/index.ts'],
  outfile: 'server/dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  minify: false,
  external: ['express', 'compression', 'socket.io'],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

console.log('server bundle written to server/dist/index.js');

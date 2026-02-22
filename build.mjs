import { build } from 'esbuild';
import { existsSync } from 'fs';

const startTime = Date.now();

console.log('Building server bundle...');

try {
  await build({
    entryPoints: ['server/server.js'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: 'server/server.bundled.cjs',
    external: [],
    minify: false,
    sourcemap: false,
    banner: {
      js: '// Agent Monitor Server - Bundled with esbuild\n// ws + chokidar included - no npm install needed\n',
    },
  });

  const elapsed = Date.now() - startTime;
  console.log(`Build complete in ${elapsed}ms`);
  console.log('Output: server/server.bundled.cjs');

  if (!existsSync('server/server.bundled.cjs')) {
    console.error('ERROR: Bundle file not created');
    process.exit(1);
  }
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}

import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npx = isWindows ? 'npx.cmd' : 'npx';

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function run(label, command, args, color) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  children.push(child);

  const forward = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(`${color}[${label}]${'\x1b[0m'} ${line}\n`);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${color}[${label}]${'\x1b[0m'} exited with code ${code}`);
    }
  });
  return child;
}

run('server', npx, ['tsx', 'watch', 'server/src/index.ts'], '\x1b[36m');
run('client', npx, ['vite', '--config', 'client/vite.config.ts'], '\x1b[35m');

console.log('\nLudo ANSARY dev servers starting…');
console.log('  client  http://localhost:5173');
console.log('  server  http://localhost:4000\n');

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

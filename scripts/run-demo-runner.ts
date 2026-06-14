import { spawn, type ChildProcess } from 'node:child_process';

function stopProcess(child: ChildProcess | undefined): void {
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
}

async function main() {
  console.log('[run-demo] Starting server...');
  const server = spawn('npm', ['--workspace', '@agentgate/server', 'run', 'start'], {
    stdio: 'inherit',
    shell: true,
  });
  let demo: ChildProcess | undefined;

  const cleanup = () => {
    stopProcess(demo);
    stopProcess(server);
  };

  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  // Poll until server is up
  let up = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000/');
      if (res.ok) {
        up = true;
        break;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!up) {
    console.error('[run-demo] Server failed to start');
    server.kill('SIGTERM');
    process.exit(1);
  }

  console.log('[run-demo] Server is up. Running demo...');
  demo = spawn('npm', ['--workspace', 'agentgate-demo', 'run', 'start'], {
    stdio: 'inherit',
    shell: true,
  });

  demo.on('close', (code) => {
    console.log(`[run-demo] Demo finished with code ${code}`);
    stopProcess(server);
    // Ensure Node process exits
    setTimeout(() => process.exit(code ?? 0), 100);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

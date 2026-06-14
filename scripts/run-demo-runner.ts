import { spawn } from 'child_process';

async function main() {
  console.log('[run-demo] Starting server...');
  const server = spawn('npm', ['--workspace', '@agentgate/server', 'run', 'start'], {
    stdio: 'inherit',
    shell: true,
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
    } catch (e) {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!up) {
    console.error('[run-demo] Server failed to start');
    server.kill('SIGTERM');
    process.exit(1);
  }

  console.log('[run-demo] Server is up. Running demo...');
  const demo = spawn('npm', ['--workspace', 'agentgate-demo', 'run', 'start'], {
    stdio: 'inherit',
    shell: true,
  });

  demo.on('close', (code) => {
    console.log(`[run-demo] Demo finished with code ${code}`);
    server.kill('SIGTERM');
    // Ensure Node process exits
    setTimeout(() => process.exit(code ?? 0), 100);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

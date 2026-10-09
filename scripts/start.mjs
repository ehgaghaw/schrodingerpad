// Railway entry point. SERVICE_ROLE=worker runs the worker, anything else the web app.
import { spawn } from 'node:child_process';
const role = process.env.SERVICE_ROLE === 'worker' ? 'start:worker' : 'start:web';
const p = spawn('npm', ['run', role], { stdio: 'inherit', shell: true });
p.on('exit', (code) => process.exit(code ?? 1));

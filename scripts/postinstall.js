#!/usr/bin/env node
import { spawn } from 'child_process';

const child = spawn('cli-lsp-client', ['stop-all'], { stdio: 'inherit' });
child.on('error', () => process.exit(0));
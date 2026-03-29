#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const criticalFiles = [
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/SPVSystem.tsx',
  'src/KanbanBoard.tsx',
  'src/services/kanbanService.ts',
];

let ok = true;
for (const file of criticalFiles) {
  const exists = fs.existsSync(path.join(rootDir, file));
  console.log(`${exists ? 'OK ' : 'MISS'} ${file}`);
  if (!exists) ok = false;
}

process.exit(ok ? 0 : 1);
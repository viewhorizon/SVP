#!/usr/bin/env node
/**
 * Script de diagnóstico para problemas de preview en blanco
 * Ejecutar: node scripts/diagnose.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}info${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.magenta}${msg}${colors.reset}`),
};

const checkDependentFiles = () => {
  log.section('Checking Critical Files Existence');
  
  const criticalFiles = [
    'index.html',
    'src/main.tsx',
    'src/App.tsx',
    'src/SPVSystem.tsx',
    'src/KanbanBoard.tsx',
    'src/components/AppErrorBoundary.tsx',
    'src/services/httpClient.ts',
    'src/services/kanbanService.ts',
    'src/services/spvApi.ts',
  ];

  let allExist = true;
  criticalFiles.forEach(file => {
    const fullPath = path.join(rootDir, file);
    const exists = fs.existsSync(fullPath);
    if (exists) {
      log.success(`${file} exists`);
    } else {
      log.error(`${file} MISSING`);
      allExist = false;
    }
  });

  return allExist;
};

const checkUnusedImports = () => {
  log.section('Checking Common Import Issues');
  
  const targetFiles = [
    'src/SPVSystem.tsx',
    'src/KanbanBoard.tsx',
    'src/App.tsx',
  ];

  let issues = [];

  targetFiles.forEach(file => {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) return;
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Check for from './services/kanbanService' with unused imports
    if (content.includes("from './services/kanbanService'")) {
      const imports = content.match(/from ['"]\.\/services\/kanbanService['"][\s\n]+{([^}]+)}/);
      if (imports) {
        const importedItems = imports[1].split(',').map(s => s.trim());
        const usedItems = importedItems.filter(item => {
          const regex = new RegExp(`\\b${item.replace(/.*\s+as\s+/, '')}\\b`, 'g');
          return regex.test(content);
        });
        
        const unused = importedItems.filter(item => !usedItems.includes(item));
        if (unused.length > 0) {
          issues.push({ file, unused });
          log.warn(`${file}: unused imports: ${unused.join(', ')}`);
        }
      }
    }
    
    // Check for undefined references
    const undefinedRefs = ['priorityStyles', 'BoardHeader', 'FiltersBar', 'KanbanColumn', 'TaskCard'];
    undefinedRefs.forEach(ref => {
      const usageRegex = new RegExp(`\\b${ref}\\b`, 'g');
      const usageCount = (content.match(usageRegex) || []).length;
      
      if (usageCount > 0) {
        const importRegex = new RegExp(`import.*${ref}`, 'g');
        const hasImport = importRegex.test(content);
        
        if (!hasImport && usageCount > 0) {
          issues.push({ file, undefined: ref });
          log.warn(`${file}: uses '${ref}' but no import found`);
        }
      }
    });
  });

  return issues.length === 0;
};

const checkCircularImports = () => {
  log.section('Checking Potential Circular Imports');
  
  const srcDir = path.join(rootDir, 'src');
  if (!fs.existsSync(srcDir)) {
    log.error('src/ directory not found');
    return false;
  }

  const imports = {};
  const extractImports = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.matchAll(/import[^'"]+['"]\.\/([^'"]+)['"]/g);
    return Array.from(matches).map(m => m[1]);
  };

  const buildImportMap = (dir) => {
    const files = fs.readdirSync(dir, { recursive: true });
    
    files.forEach(file => {
      if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
      
      const fullPath = path.join(dir, file);
      const relativePath = fullPath.replace(srcDir + path.sep, '');
      const basePath = relativePath.replace(/\.(tsx|ts)$, '');
      
      imports[`./${basePath}`] = extractImports(fullPath);
    });
  };

  try {
    buildImportMap(srcDir);
  } catch (e) {
    log.warn(`Could not build complete import map: ${e.message}`);
    return true; // Don't fail
  }

  log.success('Import map built');
  
  // Simple circular detection
  for (const [source, targets] of Object.entries(imports)) {
    for (const target of targets) {
      if (imports[target] && imports[target].includes(source)) {
        log.error(`Circular import detected: ${source} ↔ ${target}`);
        return false;
      }
    }
  }
  
  log.success('No circular imports found');
  return true;
};

const checkViteConfig = () => {
  log.section('Checking Vite Configuration');
  
  const viteConfigPath = path.join(rootDir, 'vite.config.ts');
  const prodConfigPath = path.join(rootDir, 'vite.config.prod.ts');
  
  if (!fs.existsSync(viteConfigPath)) {
    log.error('vite.config.ts not found');
    return false;
  }
  
  log.success('vite.config.ts exists');
  
  const hasProdConfig = fs.existsSync(prodConfigPath);
  if (hasProdConfig) {
    log.success('vite.config.prod.ts exists (for CSP-friendly builds)');
  } else {
    log.warn('vite.config.prod.ts not found (may cause CSP issues)');
  }

  return true;
};

const runTypeCheck = () => {
  log.section('Running TypeScript Check');
  
  try {
    execSync('npm run check', { cwd: rootDir, stdio: 'pipe' });
    log.success('TypeScript check passed');
    return true;
  } catch (e) {
    log.error('TypeScript errors detected');
    log.info('Run "npm run check" for full details');
    return false;
  }
};

const main = () => {
  log.section('Starting Project Diagnostics');
  log.info('Analyzing potential causes of blank preview issues\n');

  const results = {
    files: checkDependentFiles(),
    imports: checkUnusedImports(),
    circular: checkCircularImports(),
    vite: checkViteConfig(),
    types: runTypeCheck(),
  };

  log.section('Diagnostic Summary');
  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    log.success('All checks passed! Project should be buildable.');
    console.log('\nNext steps:');
    console.log('  1. Run "npm run dev" to test locally');
    console.log('  2. Run "npm run build" to test singlefile build');
    console.log('  3. Run "npm run build:prod-no-single" for CSP-friendly build');
    console.log('  4. If preview blank, use debug-inject.js in browser console');
  } else {
    log.error('Some checks failed. Please review warnings above.');
    console.log('\nTo fix TypeScript errors:');
    console.log('  - This is G5C responsibility (UI components)');
    console.log('  - Remove unused imports or define missing references');
    console.log('  - Run "npm run check" for full error list');
  }

  process.exit(allPassed ? 0 : 1);
};

main();
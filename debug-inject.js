// Script de diagnóstico para inyectar en runtime
// Usar devtools console:复制 todo el código y pegarlo en el console

(function() {
  'use strict';

  console.log('🔍 Debug Tool Activado');

  const debug = {
    timestamp: () => new Date().toISOString(),
    log: (msg, data) => console.log(`[${debug.timestamp()}] ${msg}`, data || ''),

    // Check 1: DOM ready状态
    checkDOM: () => {
      debug.log('DOM Check');
      const root = document.getElementById('root');
      if (!root) {
        console.error('❌ ROOT DIV NOT FOUND - index.html corrupted');
        return false;
      }
      console.log('✅ Root div exists', root.innerHTML.length > 0 ? 'with content' : 'empty');
      return true;
    },

    // Check 2: Scripts loaded状态
    checkScripts: () => {
      debug.log('Scripts Check');
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      console.log(`Loaded ${scripts.length} external scripts:`);
      scripts.forEach(s => console.log(`  - ${s.src}`));
      return scripts.length > 0;
    },

    // Check 3: CSS加载状态
    checkCSS: () => {
      debug.log('CSS Check');
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
      console.log(`Loaded ${styles.length} stylesheets/inline styles`);
      return styles.length > 0;
    },

    // Check 4: LocalStorage状态
    checkStorage: () => {
      debug.log('LocalStorage Check');
      try {
        localStorage.setItem('test-key', 'test-value');
        localStorage.getItem('test-key');
        localStorage.removeItem('test-key');
        console.log('✅ LocalStorage is working');
        return true;
      } catch (e) {
        console.error('❌ LocalStorage blocked', e);
        return false;
      }
    },

    // Check 5: React版本检测
    checkReact: () => {
      debug.log('React Check');
      const reactRoot = document.querySelector('[data-reactroot]');
      const root = document.getElementById('root');
      
      if (!root) {
        console.error('❌ Root element not found');
        return false;
      }

      const hasReactFiber = Object.keys(root).some(k => k.includes('react') || k.includes('fiber'));
      console.log(hasReactFiber ? '✅ React appears to be mounted' : '❌ React not mounted');
      return hasReactFiber;
    },

    // Check 6: Console errors收集
    checkErrors: () => {
      debug.log('Console Errors Check');
      const errorCount = window._debugErrors || 0;
      console.log(`Captured ${errorCount} errors since page load`);
      return errorCount;
    },

    // Full诊断
    fullDiagnosis: () => {
      console.log('\n' + '='.repeat(50) + ' FULL DIAGNOSIS ' + '='.repeat(50));
      
      const checks = debug.runAll();
      const passed = Object.values(checks).filter(Boolean).length;
      const total = Object.keys(checks).length;
      
      console.log(`\n📊 Result: ${passed}/${total} checks passed`);
      
      if (passed < total) {
        console.warn('⚠️ Some checks failed. Review details above.');
      } else {
        console.log('✅ All checks passed!');
      }
    },

    runAll: () => ({
      dom: debug.checkDOM(),
      scripts: debug.checkScripts(),
      css: debug.checkCSS(),
      storage: debug.checkStorage(),
      react: debug.checkReact(),
      errors: debug.checkErrors() === 0
    }),

    // Clear all data
    clearAll: () => {
      if (confirm('Do you want to clear localStorage and reload?')) {
        localStorage.clear();
        location.reload();
      }
    }
  };

  // Error capturing
  window._debugErrors = 0;
  window.addEventListener('error', () => { window._debugErrors++; });
  window.addEventListener('unhandledrejection', () => { window._debugErrors++; });

  // Expose helper
  window.debugTool = debug;

  console.log('🔧 Usage:');
  console.log('  - debugTool.fullDiagnosis()  Run full diagnosis');
  console.log('  - debugTool.clearAll()       Clear all data and reload');
  console.log('  - debugTool.runAll()        Run all checks individually');
  console.log('\n📋 Auto-running basic checks now...\n');

  // Auto-run basic checks on load
  setTimeout(() => debug.runAll(), 500);
})();
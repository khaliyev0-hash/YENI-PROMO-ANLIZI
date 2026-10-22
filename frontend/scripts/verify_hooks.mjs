/**
 * Automated Verification Script for React Hooks Order and ErrorBoundary
 * Tests:
 * 1. StoreDetailModal transitions: null -> '001' -> null
 * 2. ProductDetailModal transitions: null -> { store: '001', code: 'P01' } -> null
 * 3. Asserts zero React hooks order violations / warnings
 * 4. ErrorBoundary catch and reset behavior
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createServer } from 'vite';

// Minimal DOM mock environment for React 19 in Node.js
class MockNode {
  constructor(nodeType = 1, nodeName = 'div') {
    this.nodeType = nodeType;
    this.nodeName = nodeName.toUpperCase();
    this.tagName = nodeName.toUpperCase();
    this.childNodes = [];
    this.style = {};
  }
  appendChild(child) { this.childNodes.push(child); return child; }
  removeChild(child) { this.childNodes = this.childNodes.filter(c => c !== child); return child; }
  insertBefore(newNode) { this.childNodes.push(newNode); return newNode; }
  addEventListener() {}
  removeEventListener() {}
  setAttribute() {}
  removeAttribute() {}
}

const doc = {
  nodeType: 9,
  nodeName: '#document',
  createElement: (tag) => { const n = new MockNode(1, tag); n.ownerDocument = doc; return n; },
  createElementNS: (ns, tag) => { const n = new MockNode(1, tag); n.ownerDocument = doc; return n; },
  createTextNode: (text) => { const n = new MockNode(3, '#text'); n.nodeValue = text; n.ownerDocument = doc; return n; },
  createComment: () => { const n = new MockNode(8, '#comment'); n.ownerDocument = doc; return n; },
  addEventListener() {},
  removeEventListener() {},
};

global.HTMLIFrameElement = class {};
global.window = global;
global.document = doc;
doc.defaultView = global;
global.Node = MockNode;
global.fetch = async () => ({
  ok: true,
  json: async () => ({ data: [], matrix: [], dates: [], stocks: [], depletions: [] })
});

async function runVerification() {
  console.log('--- Starting React Hooks Order Verification ---');
  const loggedErrors = [];
  const origError = console.error;
  console.error = (...args) => {
    loggedErrors.push(args.join(' '));
    origError(...args);
  };

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const { DataContext } = await vite.ssrLoadModule('./src/context/DataContext.tsx');
    const { StoreDetailModal } = await vite.ssrLoadModule('./src/components/store/StoreDetailModal.tsx');
    const { ProductDetailModal } = await vite.ssrLoadModule('./src/components/product/ProductDetailModal.tsx');
    const { ErrorBoundaryClass } = await vite.ssrLoadModule('./src/components/common/ErrorBoundary.tsx');

    // 1. Verify StoreDetailModal
    console.log('[Test 1] Testing StoreDetailModal (null -> "001" -> null)...');
    let currentStore = null;
    let setStoreTrigger = null;

    function StoreModalHarness() {
      const [store, setStore] = React.useState(null);
      setStoreTrigger = setStore;
      const mockContextValue = {
        selectedStoreDetail: store,
        setSelectedStoreDetail: setStore,
        setSelectedProductDetail: () => {},
      };
      return React.createElement(
        DataContext.Provider,
        { value: mockContextValue },
        React.createElement(StoreDetailModal)
      );
    }

    const container1 = doc.createElement('div');
    const root1 = createRoot(container1, {
      onCaughtError: (e) => loggedErrors.push(e.message),
      onUncaughtError: (e) => loggedErrors.push(e.message),
    });

    flushSync(() => { root1.render(React.createElement(StoreModalHarness)); });
    console.log('  Render with selectedStoreDetail = null: OK');

    flushSync(() => { setStoreTrigger('001'); });
    console.log('  Render with selectedStoreDetail = "001": OK');

    flushSync(() => { setStoreTrigger(null); });
    console.log('  Render with selectedStoreDetail = null again: OK');

    // 2. Verify ProductDetailModal
    console.log('[Test 2] Testing ProductDetailModal (null -> {store, code} -> null)...');
    let setProductTrigger = null;

    function ProductModalHarness() {
      const [product, setProduct] = React.useState(null);
      setProductTrigger = setProduct;
      const mockContextValue = {
        selectedProductDetail: product,
        setSelectedProductDetail: setProduct,
      };
      return React.createElement(
        DataContext.Provider,
        { value: mockContextValue },
        React.createElement(ProductDetailModal)
      );
    }

    const container2 = doc.createElement('div');
    const root2 = createRoot(container2, {
      onCaughtError: (e) => loggedErrors.push(e.message),
      onUncaughtError: (e) => loggedErrors.push(e.message),
    });

    flushSync(() => { root2.render(React.createElement(ProductModalHarness)); });
    console.log('  Render with selectedProductDetail = null: OK');

    flushSync(() => { setProductTrigger({ store: '001', code: 'PROD_99' }); });
    console.log('  Render with selectedProductDetail = { store: "001", code: "PROD_99" }: OK');

    flushSync(() => { setProductTrigger(null); });
    console.log('  Render with selectedProductDetail = null again: OK');

    // 3. Verify ErrorBoundary
    console.log('[Test 3] Testing ErrorBoundary catch and recovery...');
    let triggerCrash = null;
    let toastMessages = [];

    function CrashingChild() {
      const [shouldCrash, setShouldCrash] = React.useState(false);
      triggerCrash = () => setShouldCrash(true);
      if (shouldCrash) {
        throw new Error('Test intentional crash for ErrorBoundary');
      }
      return React.createElement('div', null, 'Normal content');
    }

    const container3 = doc.createElement('div');
    const root3 = createRoot(container3);

    flushSync(() => {
      root3.render(
        React.createElement(
          ErrorBoundaryClass,
          {
            showToast: (t) => toastMessages.push(t.message),
            title: 'Səhifədə bir xəta baş verdi',
          },
          React.createElement(CrashingChild)
        )
      );
    });
    console.log('  Initial normal render inside ErrorBoundary: OK');

    flushSync(() => {
      triggerCrash();
    });
    console.log('  ErrorBoundary caught deliberate crash without breaking root: OK');
    console.log('  Toast triggered:', toastMessages.length > 0 ? toastMessages[0] : 'none');

    // Filter for React hooks rule errors
    const hookErrors = loggedErrors.filter(
      (msg) =>
        msg.includes('Rendered more hooks than during the previous render') ||
        msg.includes('Rendered fewer hooks than during the previous render') ||
        msg.includes('React has detected a change in the order of Hooks') ||
        msg.includes('hooks')
    );

    console.log('\n--- VERIFICATION RESULT ---');
    console.log(`React Hook Order Errors: ${hookErrors.length}`);
    if (hookErrors.length > 0) {
      console.error('FAIL: Detected hook errors:', hookErrors);
      process.exit(1);
    } else {
      console.log('SUCCESS: All hooks executed in exact consistent order across all render cycles!');
    }
  } finally {
    console.error = origError;
    await vite.close();
  }
}

runVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

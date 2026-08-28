import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library unmounts automatically only when Vitest globals are enabled.
// This project imports test helpers explicitly, matching the API workspace, so
// the teardown is registered by hand — without it, rendered trees from one test
// stay in the document and queries in the next test match stale nodes.
afterEach(cleanup);

/**
 * jsdom builds <dialog> as an element but implements none of its modal methods,
 * so a component calling showModal throws before it can render. Shimmed to the
 * two observable effects the tests read: the open flag, and the close event the
 * element fires for Escape and close() alike.
 *
 * What this deliberately does not model is the focus trap, the top layer and
 * the inerting of the background. Those are the reason the native element was
 * chosen over a hand-rolled modal, and asserting a shim of them here would only
 * prove the shim works.
 */
if (HTMLDialogElement.prototype.showModal === undefined) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

/**
 * jsdom performs no layout, so every element measures zero and ResizeObserver is
 * absent entirely. Recharts' ResponsiveContainer asks for both and draws nothing
 * at zero width, which would turn the sparkline test into an assertion that no
 * chart exists. The stub reports one fixed box, once, per observed element.
 *
 * The size is arbitrary and load-bearing only in that it is non-zero: what the
 * test checks is that a series reaches the chart, not the pixels it occupies.
 */
const OBSERVED_WIDTH_PX = 64;
const OBSERVED_HEIGHT_PX = 20;

if (typeof globalThis.ResizeObserver === 'undefined') {
  const observedSize: ResizeObserverSize = {
    inlineSize: OBSERVED_WIDTH_PX,
    blockSize: OBSERVED_HEIGHT_PX,
  };

  globalThis.ResizeObserver = class FixedBoxResizeObserver implements ResizeObserver {
    readonly #onResize: ResizeObserverCallback;

    constructor(onResize: ResizeObserverCallback) {
      this.#onResize = onResize;
    }

    observe(target: Element): void {
      const entry: ResizeObserverEntry = {
        target,
        contentRect: new DOMRect(0, 0, OBSERVED_WIDTH_PX, OBSERVED_HEIGHT_PX),
        borderBoxSize: [observedSize],
        contentBoxSize: [observedSize],
        devicePixelContentBoxSize: [observedSize],
      };
      this.#onResize([entry], this);
    }

    unobserve(): void {
      // Nothing is retained, so there is nothing to release.
    }

    disconnect(): void {
      // Nothing is retained, so there is nothing to release.
    }
  };
}

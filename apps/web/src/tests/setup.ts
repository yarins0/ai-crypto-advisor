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

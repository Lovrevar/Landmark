// Resolves on the next macrotask, giving the browser a chance to repaint and
// handle pending input between batches of synchronous work. Used to keep the
// UI responsive during long PDF-builder loops.
export const yieldToUI = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0))

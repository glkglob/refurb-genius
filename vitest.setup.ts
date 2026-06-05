import "@testing-library/jest-dom/vitest";

// Polyfill for jsdom if needed by some UI (e.g. matchMedia for sidebar etc).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Polyfills for observers used by migrated UI components (carousel/embla, chart/recharts, resizable, input-otp, etc.)
// These are not provided by jsdom by default; simple no-op implementations suffice for render/smoke tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error - polyfill
  globalThis.ResizeObserver = ResizeObserver;
  if (typeof window !== "undefined") {
    // @ts-expect-error - polyfill
    window.ResizeObserver = ResizeObserver;
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error - polyfill
  globalThis.IntersectionObserver = IntersectionObserver;
  if (typeof window !== "undefined") {
    // @ts-expect-error - polyfill
    window.IntersectionObserver = IntersectionObserver;
  }
}

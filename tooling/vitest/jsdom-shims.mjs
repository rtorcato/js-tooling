// jsdom doesn't ship the browser APIs that Radix UI, cmdk, embla-carousel,
// react-day-picker and friends call at mount time. Import this file from your
// vitest setupFiles to install no-op polyfills for all of them:
//
//   // vitest.config.ts -> test.setupFiles
//   import '@rtorcato/js-tooling/vitest/jsdom-shims'
//
// Side-effect only; nothing is exported.

if (typeof Element !== 'undefined') {
	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = () => false
	}
	if (!Element.prototype.setPointerCapture) {
		Element.prototype.setPointerCapture = () => {}
	}
	if (!Element.prototype.releasePointerCapture) {
		Element.prototype.releasePointerCapture = () => {}
	}
	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {}
	}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
	globalThis.IntersectionObserver = class IntersectionObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords() {
			return []
		}
		root = null
		rootMargin = ''
		thresholds = []
	}
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
	window.matchMedia = (query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	})
}

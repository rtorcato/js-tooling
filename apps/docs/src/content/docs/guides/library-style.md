---
title: Library style guide
description: JSDoc shape, naming conventions, and type-test patterns for TypeScript libraries that use this tooling.
---

This guide collects the conventions that emerged from building [`@rtorcato/browser-common`](https://github.com/rtorcato/browser-common) with `@rtorcato/js-tooling`. Nothing here is enforced by linting — Biome doesn't deep-check JSDoc — but every convention has paid off in IDE hover docs, refactor safety, or shipping confidence.

Apply them to any library where the public API matters more than internal implementation details.

## 1. JSDoc shape

Every exported function gets a block with this order:

1. One-line summary.
2. `@param` for each parameter (if not obvious from the type).
3. `@returns` describing the return value (if not obvious from the type).
4. `@remarks` for runtime requirements the type system can't express — HTTPS, user-gesture, permission grants, platform limits.
5. `@example` showing realistic use, with the **public import path** (not a relative path).

```ts
/**
 * Copies a string to the system clipboard.
 *
 * @param text - The text to copy.
 * @returns `true` if the copy succeeded, `false` otherwise.
 * @remarks
 * Requires HTTPS or a user-gesture-initiated handler in most browsers.
 * @example
 * ```ts
 * import { copyToClipboard } from '@my-org/my-lib/clipboard'
 * button.addEventListener('click', () => copyToClipboard('hello'))
 * ```
 */
export async function copyToClipboard(text: string): Promise<boolean> { ... }
```

Why each piece matters:

- **Public import path in `@example`** — when someone hovers the function in their IDE, the example is copy-paste-ready. A relative path like `'./copyToClipboard'` is useless to consumers.
- **`@remarks` for platform requirements** — these are the failures users actually hit. The type signature can't say "this throws on HTTP".
- **One short summary** — IDE hover renders the summary above the rest. Make it actionable.

Don't write long docstring paragraphs. If a function needs paragraphs of context, it's probably doing too much.

## 2. `is<Name>Available()` guard convention

For libraries that wrap platform APIs (browser, Node-specific, runtime-conditional), expose a uniform guard:

```ts
export function isClipboardApiAvailable(): boolean {
	return typeof navigator !== 'undefined' && !!navigator.clipboard
}
```

Conventions:

- **Name**: `is<Name>Available`, not `is<Name>Supported`. "Available" implies a runtime check; "supported" reads like a marketing claim.
- **Return type**: always `boolean`. Never `'yes' | 'no' | 'maybe'`.
- **Behavior**: must not throw, must not have side effects, must be safe to call from any environment (including SSR).

Operations gated by the guard should return `null` / `false` / empty on unsupported environments rather than throwing. This makes the library safe to import anywhere — calls become no-ops on the wrong runtime instead of crashing the page.

## 3. Type tests with `expectTypeOf`

For libraries where signatures are part of the product (callback shapes, generic constraints, discriminated unions), add type-level tests using Vitest's built-in `expectTypeOf` (re-exported from `expect-type` — no new dependency).

```ts
import { describe, expectTypeOf, it } from 'vitest'
import { observeIntersection } from '../intersection'

describe('intersection', () => {
	it('observeIntersection accepts Element + callback + optional options', () => {
		expectTypeOf(observeIntersection).parameters.toEqualTypeOf<
			[Element, IntersectionObserverCallback, IntersectionObserverInit?]
		>()
		expectTypeOf(observeIntersection).returns.toEqualTypeOf<IntersectionObserver>()
	})
})
```

When to add them:

- The function returns a generic (e.g., `Promise<T>` where `T` matters to callers).
- The callback shape is the API surface.
- A discriminated union narrows behavior based on input type.

When to skip them:

- Trivial wrappers where the signature is one line and unlikely to drift.
- Functions whose tests already exercise the type implicitly via realistic call sites.

Type tests are cheap to add, free to run, and catch regressions during refactors that runtime tests miss.

## 4. Meta-tests for library contracts

Two contracts are easy to break silently as a library grows: the `package.json` `exports` map drifting from the source folders, and modules accidentally gaining a top-level dependency on `window` / `document`. `@rtorcato/js-tooling` ships helpers for both.

### Exports stay in sync with `src/`

```ts
// src/tests/exports-resolution.test.ts
import { fileURLToPath } from 'node:url'
import { runExportsResolutionTest } from '@rtorcato/js-tooling/tests/exports-resolution'

runExportsResolutionTest({
	packageJsonPath: fileURLToPath(new URL('../../package.json', import.meta.url)),
	srcDir: fileURLToPath(new URL('../', import.meta.url)),
	excludeDirs: ['tests'],
})
```

Fails when a new `src/<name>/` folder is added without a matching subpath export, or when an export points at a folder that no longer exists.

### Every module is SSR-safe

```ts
// src/tests/ssr-safety.test.ts
import { fileURLToPath } from 'node:url'
import { runSsrSafetyTest } from '@rtorcato/js-tooling/tests/ssr-safety'

runSsrSafetyTest({
	srcDir: fileURLToPath(new URL('../', import.meta.url)),
	excludeDirs: ['tests'],
})
```

Runs in the `node` environment and dynamically imports every module. Fails if a module accesses `window` / `document` / `navigator` at the top level instead of inside a guarded function.

## 5. References

These conventions are exercised in production by:

- [@rtorcato/browser-common](https://github.com/rtorcato/browser-common) — the canonical reference. Every module under `src/` follows the JSDoc shape, the `is<Name>Available()` guard, and the meta-test contracts above.

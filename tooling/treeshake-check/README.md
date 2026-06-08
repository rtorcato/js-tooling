# treeshake-check

End-to-end tree-shaking verification for libraries that ship subpath exports + `sideEffects: false`.

Use `npx @rtorcato/js-tooling fix treeshake-check` to scaffold an `apps/treeshake-check/` workspace package. It bundles a single subpath import via esbuild + metafile and fails the build if any other subpath leaks into the bundle inputs.

The generated `check.mjs` script is parameterized on:

- the workspace package name (e.g., `@my-org/my-lib`)
- the **allowed subpath** (the one the consumer imports — e.g., `clipboard`)
- the **forbidden subpaths** (every other subpath the package exposes)

Output: bundle size + assertion. Non-zero exit on leak. Wire into `pnpm verify` so the check runs on every push.

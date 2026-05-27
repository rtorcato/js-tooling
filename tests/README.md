# Tests

Vitest test suite for `@rtorcato/js-tooling`.

## Layout

```
tests/
├── cli/
│   └── generators/      # one file per generator under src/cli/generators/
├── helpers/
│   └── tmp-dir.ts       # isolated tmp dir per test, auto-cleaned in afterEach
└── example.test.ts      # sanity check that vitest is wired up
```

## Running

```bash
pnpm test          # watch mode
pnpm test --run    # single run (used in CI)
pnpm coverage      # coverage report
```

## Writing generator tests

Each generator is a pure function that writes files into a target directory. Use the `useTmpDir` helper to isolate writes per test:

```ts
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

it('writes a config', async () => {
  const dir = newTmpDir()
  await myGenerator(config, dir)
  expect(await fs.readJson(`${dir}/foo.json`)).toMatchObject({ /* ... */ })
})
```

Vitest's `afterEach` cleans up the tmp dir automatically.

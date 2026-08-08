# Tests

Vitest test suite for `@rtorcato/repo-tooling`.

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

## Integration (preset lifecycle)

`scripts/integration/preset-lifecycle.mjs <preset>` scaffolds a preset from the
current working tree, repoints its `@rtorcato/repo-tooling` dep at a `pnpm pack`
tarball, then installs, builds and runs `pnpm verify` against it. This is the only
check that exercises a real install, so it's where missing dependencies and bad
shipped configs surface.

```bash
pnpm build-cli                                          # required first
node scripts/integration/preset-lifecycle.mjs react-app
```

Wired presets: `library`, `node-api`, `web-app`, `react-app`, `nextjs-app`. Each
declares its own seed files and whether it has a build step in the `PRESETS` map —
the presets are tooling-only, so the script writes the app source a consumer would
bring. Anything the *tooling* needs belongs in the generator's dependency list, not
in the script's `appDeps`, so a gap there fails the test instead of being hidden.

All five run in CI on every pull request and push, on each supported Node major.
The whole set takes about 1m40s, so there's no coverage gate to reason about.

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

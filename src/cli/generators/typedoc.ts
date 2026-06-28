import path from 'node:path'
import fs from 'fs-extra'

type Pkg = Record<string, unknown> | null

const DOCS_WORKFLOW = `name: 📚 Docs
on:
  push:
    branches: [main]
jobs:
  docs:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm docs
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
`

export async function generateTypedocConfig(pkg: Pkg, targetDir: string) {
	const name = (pkg?.name as string | undefined) ?? 'My Library'
	const config = {
		extends: ['@rtorcato/js-tooling/typedoc'],
		entryPoints: ['./src/index.ts'],
		name,
	}
	await fs.writeJson(path.join(targetDir, 'typedoc.json'), config, { spaces: 2 })
}

export async function generateTypedocWorkflow(targetDir: string): Promise<string> {
	const workflowsDir = path.join(targetDir, '.github', 'workflows')
	await fs.ensureDir(workflowsDir)
	await fs.writeFile(path.join(workflowsDir, 'docs.yml'), DOCS_WORKFLOW)
	return '.github/workflows/docs.yml'
}

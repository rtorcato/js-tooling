import path from 'node:path'
import fs from 'fs-extra'

/**
 * Scaffold Release Please — Google's changelog/PR-driven release tool, an
 * alternative to semantic-release and Changesets. It runs entirely as a GitHub
 * Action, so the setup is two manifest files (config + version manifest) plus a
 * workflow; there are no npm devDependencies to install.
 *
 * Every file is safe-add — an existing one is never clobbered — so this can also
 * repair a partial setup.
 */
export async function generateReleasePlease(targetDir: string): Promise<string[]> {
	const written: string[] = []

	const files: Array<[string, string]> = [
		['release-please-config.json', RELEASE_PLEASE_CONFIG],
		['.release-please-manifest.json', RELEASE_PLEASE_MANIFEST],
		[path.join('.github', 'workflows', 'release-please.yml'), RELEASE_PLEASE_WORKFLOW],
	]

	for (const [rel, content] of files) {
		const dest = path.join(targetDir, rel)
		if (await fs.pathExists(dest)) continue
		await fs.ensureDir(path.dirname(dest))
		await fs.writeFile(dest, content)
		written.push(rel)
	}

	return written
}

// Single package at the repo root, Node release type. Consumers add more
// entries under `packages` for a monorepo.
const RELEASE_PLEASE_CONFIG = `{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md"
    }
  }
}
`

// Tracks the last released version per package. Release Please updates this on
// every release PR; start at 0.0.0 (or your current version).
const RELEASE_PLEASE_MANIFEST = `{
  ".": "0.0.0"
}
`

const RELEASE_PLEASE_WORKFLOW = `name: release-please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          # GITHUB_TOKEN works for opening the release PR. If main is protected
          # against the default token, swap in an admin PAT:
          #   token: \${{ secrets.RELEASE_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
`

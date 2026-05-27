import fs from 'fs-extra'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'

export function useTmpDir(): () => string {
	let current: string | null = null

	afterEach(async () => {
		if (current) {
			await fs.remove(current)
			current = null
		}
	})

	return () => {
		current = mkdtempSync(join(tmpdir(), 'js-tooling-test-'))
		return current
	}
}

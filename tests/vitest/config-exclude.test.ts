import { describe, expect, it } from 'vitest'
import { configDefaults } from 'vitest/config'
// @ts-expect-error — .mjs preset ships no types; we only read runtime values here.
import config from '../../tooling/vitest/vitest.config.mjs'

describe('vitest preset exclude', () => {
	it('ignores Claude Code worktrees so mirrored test files are not collected twice', () => {
		const exclude = config.test?.exclude ?? []
		expect(exclude).toContain('.claude/**')
		// still keeps vitest's built-in defaults (node_modules, dist, …).
		for (const def of configDefaults.exclude) {
			expect(exclude).toContain(def)
		}
	})
})

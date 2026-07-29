import { describe, expect, it } from 'vitest'
import { LANGUAGES, resolveLanguageModule } from '../../src/languages/registry.js'

describe('resolveLanguageModule', () => {
	it('maps unknown (bare dir mid-setup) to the JS module', () => {
		expect(resolveLanguageModule('unknown')).toBe(LANGUAGES.js)
	})

	it.each(['js', 'swift', 'python', 'perl'] as const)('resolves %s to its own module', (id) => {
		expect(resolveLanguageModule(id).id).toBe(id)
	})

	it('JS and Swift carry modules; Python and Perl gate out until theirs land', () => {
		expect(LANGUAGES.js.supported).toBe(true)
		// Swift flipped with its module (#286).
		expect(LANGUAGES.swift.supported).toBe(true)
		expect(LANGUAGES.python.supported).toBe(false)
		expect(LANGUAGES.perl.supported).toBe(false)
	})

	it('carries the CodeQL matrix identifier the code-scanning workflow uses', () => {
		expect(LANGUAGES.js.codeqlLanguages).toEqual(['javascript-typescript'])
		expect(LANGUAGES.perl.codeqlLanguages).toEqual([]) // CodeQL has no Perl analyzer
	})
})

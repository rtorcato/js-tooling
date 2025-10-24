export default {
	extends: ['@commitlint/config-conventional'],
	ignores: [(commit) => commit.includes('[skip ci]')],
	rules: {
		// Enforce strict type validation
		'type-enum': [
			2,
			'always',
			[
				'build',
				'chore',
				'ci',
				'docs',
				'feat',
				'fix',
				'perf',
				'refactor',
				'revert',
				'style',
				'test',
			],
		],
		// Enforce length limits (strict)
		'header-max-length': [2, 'always', 50],
		'body-max-line-length': [2, 'always', 72],
		'footer-max-line-length': [2, 'always', 72],
		// Enforce case rules (allow common patterns)
		'subject-case': [0], // Disable case enforcement to allow flexibility
		'type-case': [2, 'always', 'lower-case'],
		// Enforce required elements
		'type-empty': [2, 'never'],
		'subject-empty': [2, 'never'],
		// Enforce punctuation rules
		'subject-full-stop': [2, 'never', '.'],
		// Enforce scope rules (optional but recommended)
		'scope-case': [2, 'always', 'lower-case'],
	},
}

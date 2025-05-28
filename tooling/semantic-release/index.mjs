export default {
	branches: [
		'+([0-9])?(.{+([0-9]),x}).x',
		'main', // → stable
		'ci-testing',
		'next',
		'release',
		'next-major', // → next-major branch = next-major tag
		{ name: 'dev', prerelease: 'dev' }, // → dev branch = dev tag
		{ name: 'beta', prerelease: true }, // → beta branch = beta tag
		{ name: 'alpha', prerelease: true }, // → alpha branch = alpha tag
	],
	repositoryUrl: `https://gitlab-ci-token:${process.env.GITLAB_TOKEN}@gitlab.com/${process.env.CI_PROJECT_NAMESPACE}/${process.env.CI_PROJECT_NAME}.git`,
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				preset: 'conventionalcommits',
				releaseRules: [
					{ breaking: true, release: 'major' }, // Major release for breaking changes
					{ type: 'feat', release: 'minor' }, // Minor release for features
					{ type: 'fix', release: 'patch' }, // Patch release for bug fixes
					{
						type: 'docs', // Documentation changes
						scope: 'README', // Specific scope for README changes
						release: false, // no Patch release for README changes
					},
					// { type: 'chore', release: 'patch' }, // Chore changes
					{ type: 'update', release: 'patch' },
					{ type: 'refactor', release: 'patch' },
					{ type: 'revert', release: 'patch' },
					{ type: 'style', release: false },
					{ type: 'test', release: false },
				],
				parserOpts: {
					noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
				},
			},
		],
		'@semantic-release/release-notes-generator',
		// Release notes generator plugin to generate release notes
		[
			'@semantic-release/gitlab',
			{
				assets: ['dist/*.js', 'dist/*.js.map', 'CHANGELOG.md', 'package.json', 'README.md'],
				message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
				gitlabUrl: 'https://gitlab.com',
			},
		],
		[
			'@semantic-release/changelog',
			{
				changelogFile: 'CHANGELOG.md',
			},
		],
		['@semantic-release/npm', { npmPublish: true, pkgRoot: '.' }],
		// NPM plugin to publish the package
		[
			'@semantic-release/git',
			{
				assets: ['package.json', 'CHANGELOG.md'],
				message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
				// Skip hooks by disabling Husky
				skipCommitHooks: true,
				prepareCmd: 'pnpm exec biome format package.json',
			},
		],
	],
}

// [
// 	'@semantic-release/exec',
// 	{
// 		prepareCmd: 'pnpm exec biome format',
// 	},
// ],

export default {
	branches: [
		'+([0-9])?(.{+([0-9]),x}).x',
		'main',
		'ci-testing',
		'next',
		'release',
		'next-major',
		{ name: 'beta', prerelease: true },
		{ name: 'alpha', prerelease: true },
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
					{ type: 'refactor', release: 'patch' },
					{ type: 'revert', release: 'patch' },
					{ type: 'style', release: false },
					{ type: 'test', release: false },
					// { type: 'chore', release: 'patch' }, // Chore changes
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
			'@semantic-release/exec',
			{
				prepareCmd: `
					docker push registry.gitlab.com/${CI_PROJECT_PATH}:${nextRelease.version} &&
					docker tag registry.gitlab.com/${CI_PROJECT_PATH}:${nextRelease.version} registry.gitlab.com/${CI_PROJECT_PATH}:latest &&
					docker push registry.gitlab.com/${CI_PROJECT_PATH}:latest
				`,
			},
		],
	],
}

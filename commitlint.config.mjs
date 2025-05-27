// import config from '/builds/rtorcato/js-tooling/tooling/commitlint.config.cjs'

// export default config

export default {
	extends: ['@commitlint/config-conventional'],
	ignores: [(commit) => commit.includes('[skip ci]')],
}

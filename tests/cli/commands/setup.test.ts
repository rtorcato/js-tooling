import { join } from 'node:path'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupProject } from '../../../src/cli/commands/setup.js'
import {
	buildPresetConfig,
	computeFileList,
	CONFIG_SCHEMA,
	PRESET_NAMES,
	validateProjectConfig,
} from '../../../src/cli/commands/setup-presets.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('setup-presets', () => {
	it('builds a valid config for every preset', () => {
		for (const name of PRESET_NAMES) {
			const config = buildPresetConfig(name, 'demo')
			const { valid, errors } = validateProjectConfig(config)
			expect(valid, `${name}: ${errors.join('; ')}`).toBe(true)
		}
	})

	it('library preset enables semantic release and tsup', () => {
		const config = buildPresetConfig('library', 'demo')
		expect(config.semanticRelease).toBe(true)
		expect(config.bundler).toBe('tsup')
	})

	it('react-app preset uses vite + browser environment', () => {
		const config = buildPresetConfig('react-app', 'demo')
		expect(config.bundler).toBe('vite')
		expect(config.testing.environment).toBe('browser')
	})

	it('nextjs-app preset uses eslint + no bundler', () => {
		const config = buildPresetConfig('nextjs-app', 'demo')
		expect(config.linting.tool).toBe('eslint')
		expect(config.linting.eslintConfig).toBe('nextjs')
		expect(config.bundler).toBe('none')
	})

	it('enables aiSetup by default and lists AI files when on', () => {
		const config = buildPresetConfig('library', 'demo')
		expect(config.aiSetup).toBe(true)
		const files = computeFileList(config)
		expect(files).toContain('AGENTS.md')
		expect(files).toContain('CLAUDE.md')
		expect(files).toContain('.mcp.json.example')
	})

	it('omits AI files from the list when aiSetup is off', () => {
		const config = { ...buildPresetConfig('library', 'demo'), aiSetup: false }
		const files = computeFileList(config)
		expect(files).not.toContain('AGENTS.md')
		expect(files).not.toContain('.mcp.json.example')
	})
})

describe('validateProjectConfig', () => {
	it('rejects unknown fields', () => {
		const result = validateProjectConfig({
			...buildPresetConfig('library', 'demo'),
			somethingExtra: true,
		})
		expect(result.valid).toBe(false)
		expect(result.errors).toContain('Unknown field: somethingExtra')
	})

	it('rejects missing required fields', () => {
		const config = buildPresetConfig('library', 'demo') as Record<string, unknown>
		delete config.gitHooks
		const result = validateProjectConfig(config)
		expect(result.valid).toBe(false)
		expect(result.errors).toContain('Missing required field: gitHooks')
	})

	it('rejects non-objects', () => {
		expect(validateProjectConfig('hi').valid).toBe(false)
		expect(validateProjectConfig(null).valid).toBe(false)
		expect(validateProjectConfig([]).valid).toBe(false)
	})

	it('accepts a valid preset-built config', () => {
		const config = buildPresetConfig('node-api', 'demo')
		expect(validateProjectConfig(config).valid).toBe(true)
	})
})

describe('computeFileList', () => {
	it('includes baseline + bundler + security for a library', () => {
		const files = computeFileList(buildPresetConfig('library', 'demo'))
		expect(files).toContain('package.json')
		expect(files).toContain('.editorconfig')
		expect(files).toContain('tsup.config.ts')
		expect(files).toContain('release.config.mjs')
		expect(files).toContain('.github/dependabot.yml')
	})

	it('omits release.config.mjs for non-library presets', () => {
		const files = computeFileList(buildPresetConfig('node-api', 'demo'))
		expect(files).not.toContain('release.config.mjs')
	})

	it('includes vite config for react-app', () => {
		const files = computeFileList(buildPresetConfig('react-app', 'demo'))
		expect(files).toContain('vite.config.ts')
		expect(files).not.toContain('tsup.config.ts')
	})

	it('lists bunfig.toml when targeting Bun (#225)', () => {
		expect(computeFileList({ ...buildPresetConfig('library', 'demo'), bun: true })).toContain(
			'bunfig.toml'
		)
		// Off by default — no bunfig unless opted in.
		expect(computeFileList(buildPresetConfig('library', 'demo'))).not.toContain('bunfig.toml')
	})
})

describe('setup --config-schema', () => {
	it('prints the JSON Schema to stdout and exits', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({ directory: '.', configSchema: true })
			const printed = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(printed.title).toBe('ProjectConfig')
			expect(printed.$schema).toMatch(/json-schema/)
			expect(printed).toEqual(CONFIG_SCHEMA)
		} finally {
			logSpy.mockRestore()
		}
	})
})

describe('setup --dry-run', () => {
	it('with --preset prints the resolved config and file list, writes nothing', async () => {
		const dir = newTmpDir()
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({
				directory: dir,
				preset: 'library',
				dryRun: true,
				skipInstall: true,
			})
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.directory).toBe(dir)
			expect(payload.config.projectType).toBe('library')
			expect(payload.files).toContain('tsup.config.ts')
		} finally {
			logSpy.mockRestore()
		}
		// Nothing should be written.
		const entries = await fs.readdir(dir)
		expect(entries).toEqual([])
	})

	it('with --config reads the file and prints it', async () => {
		const dir = newTmpDir()
		const config = buildPresetConfig('node-api', 'my-api')
		const configPath = join(dir, 'project.json')
		await fs.writeJson(configPath, config)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({
				directory: dir,
				config: configPath,
				dryRun: true,
				skipInstall: true,
			})
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.config.projectType).toBe('node-api')
		} finally {
			logSpy.mockRestore()
		}
	})
})

describe('setup --preset', () => {
	it('scaffolds a library project without prompts', async () => {
		const dir = newTmpDir()
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({
				directory: dir,
				preset: 'library',
				skipInstall: true,
			})
		} finally {
			logSpy.mockRestore()
		}
		expect(await fs.pathExists(join(dir, 'package.json'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'tsup.config.ts'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.editorconfig'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(true)
	})

	it('rejects unknown preset names', async () => {
		const dir = newTmpDir()
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit')
		}) as never)
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(
				setupProject({
					directory: dir,
					preset: 'not-a-preset',
					skipInstall: true,
				})
			).rejects.toThrow('exit')
		} finally {
			exitSpy.mockRestore()
			errSpy.mockRestore()
		}
	})
})

describe('setup --config', () => {
	it('reads a JSON ProjectConfig and uses it instead of prompts', async () => {
		const dir = newTmpDir()
		const config = buildPresetConfig('node-api', 'my-api')
		const configPath = join(dir, 'project.json')
		await fs.writeJson(configPath, config)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({
				directory: dir,
				config: configPath,
				skipInstall: true,
			})
		} finally {
			logSpy.mockRestore()
		}
		expect(await fs.pathExists(join(dir, 'package.json'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'build.mjs'))).toBe(true)
	})

	it('accepts a .repo-tooling.json lockfile and unwraps its config (#271)', async () => {
		const dir = newTmpDir()
		const config = buildPresetConfig('node-api', 'my-api')
		// A lockfile wraps the config alongside version/writtenBy/etc — those extra
		// keys would fail validation if not unwrapped.
		const lockfile = {
			$schema: 'https://rtorcato.github.io/repo-tooling/schemas/lockfile.json',
			version: 2,
			config,
			writtenBy: '@rtorcato/repo-tooling@0.0.0',
			writtenAt: '2026-01-01T00:00:00.000Z',
		}
		const configPath = join(dir, '.repo-tooling.json')
		await fs.writeJson(configPath, lockfile)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({ directory: dir, config: configPath, dryRun: true, skipInstall: true })
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.config.projectType).toBe('node-api')
			expect(payload.config.version).toBeUndefined()
		} finally {
			logSpy.mockRestore()
		}
	})

	it('rejects configs with unknown fields', async () => {
		const dir = newTmpDir()
		const configPath = join(dir, 'project.json')
		await fs.writeJson(configPath, {
			...buildPresetConfig('library', 'demo'),
			somethingExtra: true,
		})
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit')
		}) as never)
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(
				setupProject({
					directory: dir,
					config: configPath,
					skipInstall: true,
				})
			).rejects.toThrow('exit')
		} finally {
			exitSpy.mockRestore()
			errSpy.mockRestore()
		}
	})
})

// The interactive path (#284). `prompt` is called once for the language, then
// once for the JS question list — queue an answer per call.
describe('setup language prompt', () => {
	function mockPrompt(...answers: Array<Record<string, unknown>>) {
		const spy = vi.spyOn(inquirer, 'prompt')
		for (const answer of answers) {
			spy.mockImplementationOnce((async () => answer) as never)
		}
		return spy
	}

	const JS_ANSWERS = {
		projectName: 'demo',
		projectType: 'library',
		useTypeScript: true,
		tsConfig: 'base',
		lintingTool: 'biome',
		testingFramework: 'vitest',
		gitHooks: false,
		commitLint: false,
		releaseTool: 'none',
		securityAutomation: false,
		aiSetup: false,
		badges: false,
		bundler: 'none',
	}

	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('defaults to the language detected in the target directory', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'Package.swift'), '// swift-tools-version:6.0\n')
		const spy = mockPrompt({ language: 'swift' })
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({ directory: dir, skipInstall: true })
			const question = (spy.mock.calls[0]?.[0] as Array<Record<string, unknown>>)[0]
			expect(question.name).toBe('language')
			expect(question.default).toBe('swift')
		} finally {
			logSpy.mockRestore()
		}
	})

	it('falls back to js for a directory with no language marker', async () => {
		const dir = newTmpDir()
		const spy = mockPrompt({ language: 'perl' })
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({ directory: dir, skipInstall: true })
			const question = (spy.mock.calls[0]?.[0] as Array<Record<string, unknown>>)[0]
			expect(question.default).toBe('js')
		} finally {
			logSpy.mockRestore()
		}
	})

	it('offers every registered language, flagging the ones without a module', async () => {
		const dir = newTmpDir()
		const spy = mockPrompt({ language: 'js' }, JS_ANSWERS)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({ directory: dir, skipInstall: true })
			const question = (spy.mock.calls[0]?.[0] as Array<Record<string, unknown>>)[0]
			const choices = question.choices as Array<{ name: string; value: string }>
			expect(choices.map((c) => c.value)).toEqual(['js', 'swift', 'python', 'perl'])
			expect(choices.find((c) => c.value === 'js')?.name).not.toMatch(/lands with/)
			expect(choices.find((c) => c.value === 'swift')?.name).toMatch(/lands with its module/)
		} finally {
			logSpy.mockRestore()
		}
	})

	it('writes nothing and points at doctor when the language has no module yet', async () => {
		const dir = newTmpDir()
		mockPrompt({ language: 'swift' })
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({ directory: dir, skipInstall: true })
			const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
			expect(output).toMatch(/Swift scaffolding isn't available yet/)
			expect(output).toMatch(/doctor/)
		} finally {
			logSpy.mockRestore()
		}
		expect(await fs.readdir(dir)).toEqual([])
	})

	it('records the chosen language in the lockfile instead of a hardcoded js', async () => {
		const dir = newTmpDir()
		mockPrompt({ language: 'js' }, JS_ANSWERS)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await setupProject({ directory: dir, skipInstall: true })
		} finally {
			logSpy.mockRestore()
		}
		const lock = await fs.readJson(join(dir, '.repo-tooling.json'))
		expect(lock.config.language).toBe('js')
	})
})

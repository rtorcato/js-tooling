import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import {
	buildSkillsInstallBody,
	installSkillsInstallDocs,
} from '../../../src/cli/generators/skills-install.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

async function scaffoldSkill(dir: string, name: string): Promise<void> {
	await fs.ensureDir(join(dir, 'skills', name))
	await fs.writeFile(join(dir, 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`)
}

describe('buildSkillsInstallBody', () => {
	it('emits one npx skills add command per skill, singular vs plural heading', () => {
		expect(buildSkillsInstallBody('rtorcato', 'browser-common', ['browser-common'])).toContain(
			'npx skills add https://github.com/rtorcato/browser-common --skill browser-common'
		)
		const multi = buildSkillsInstallBody('rtorcato', 'js-tooling', ['js-tooling', 'npm-publish'])
		expect(multi).toContain('## Install the skills')
		expect(multi).toContain('--skill js-tooling')
		expect(multi).toContain('--skill npm-publish')
	})

	it('returns empty for no skills', () => {
		expect(buildSkillsInstallBody('rtorcato', 'x', [])).toBe('')
	})
})

describe('installSkillsInstallDocs', () => {
	it('no-ops when the repo ships no skills', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'x',
			repository: 'github:rtorcato/x',
		})
		expect(await installSkillsInstallDocs(dir)).toBeNull()
		expect(await fs.pathExists(join(dir, 'README.md'))).toBe(false)
	})

	it('no-ops when package.json has no GitHub repository', async () => {
		const dir = newTmpDir()
		await scaffoldSkill(dir, 'browser-common')
		await fs.writeJson(join(dir, 'package.json'), { name: 'browser-common' })
		expect(await installSkillsInstallDocs(dir)).toBeNull()
	})

	it('upserts a merge-safe block into README, idempotently', async () => {
		const dir = newTmpDir()
		await scaffoldSkill(dir, 'browser-common')
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'browser-common',
			repository: 'git+https://github.com/rtorcato/browser-common.git',
		})
		await fs.writeFile(join(dir, 'README.md'), '# browser-common\n\nMy notes.\n')

		expect(await installSkillsInstallDocs(dir)).toBe('README.md')
		await installSkillsInstallDocs(dir) // run twice

		const readme = await fs.readFile(join(dir, 'README.md'), 'utf8')
		expect(readme).toContain('# browser-common')
		expect(readme).toContain('My notes.')
		expect(readme).toContain(
			'npx skills add https://github.com/rtorcato/browser-common --skill browser-common'
		)
		expect(readme.match(/<!-- js-tooling:skills:start -->/g)).toHaveLength(1)
	})
})

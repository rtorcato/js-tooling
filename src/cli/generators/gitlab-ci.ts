import path from 'node:path'
import fs from 'fs-extra'
import { renderGitLabCI } from '../../base/ci.js'
import { gitlabSpec } from '../../languages/js/ci.js'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateGitLabCI(config: ProjectConfig, targetDir: string) {
	const yamlPath = path.join(targetDir, '.gitlab-ci.yml')
	// ponytail: direct JS import until a second language module ships CI (#287).
	await fs.writeFile(yamlPath, renderGitLabCI(gitlabSpec(config)))
	return '.gitlab-ci.yml'
}

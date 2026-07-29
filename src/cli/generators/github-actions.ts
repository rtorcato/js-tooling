import fs from 'fs-extra'
import path from 'node:path'
import { renderGitHubWorkflow } from '../../base/ci.js'
import { githubJobs, usesCoverage } from '../../languages/js/ci.js'
import type { ProjectConfig } from '../commands/setup.js'

// Minimal Codecov config — auto targets keep it from failing a fresh repo that
// has no baseline yet, while the 1% threshold tolerates rounding noise.
// https://docs.codecov.com/docs/codecov-yaml
const CODECOV_YML = `coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: auto
        threshold: 1%
`

export async function generateGitHubActions(config: ProjectConfig, targetDir: string) {
	const workflowsDir = path.join(targetDir, '.github', 'workflows')
	await fs.ensureDir(workflowsDir)

	// This is the JS path specifically. Swift (#287) renders its own workflow
	// from `src/languages/swift/ci.ts` rather than dispatching through here: it
	// takes no ProjectConfig at all (its jobs derive from Package.swift), so a
	// shared entry point would mean inventing a fake config to pass in. Both
	// paths meet at renderGitHubWorkflow() in src/base/ci.ts, which is the seam
	// that actually matters.
	const workflow = renderGitHubWorkflow(githubJobs(config))
	await fs.writeFile(path.join(workflowsDir, 'ci.yml'), workflow)

	// codecov.yml is the CI's coverage-upload companion — emit it alongside ci.yml
	// whenever the workflow uploads coverage, so the codecov badge isn't red.
	if (usesCoverage(config)) {
		await fs.writeFile(path.join(targetDir, 'codecov.yml'), CODECOV_YML)
	}
}

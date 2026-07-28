export type CheckStatus = 'ok' | 'drift' | 'missing' | 'optional-missing'

export interface CheckResult {
	check: string
	status: CheckStatus
	detail: string
	hint?: string
}

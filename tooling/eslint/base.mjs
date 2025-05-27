/// <reference types="./types.d.ts" />

import eslint from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import jestPlugin from 'eslint-plugin-jest'
import tseslint from 'typescript-eslint'

// import path from 'path';
// import url from 'url';

// const __filename = url.fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

/**
 * All packages that leverage t3-env should use this rule
 */
export const restrictEnvAccess = tseslint.config({
	files: ['**/*.js', '**/*.ts', '**/*.tsx'],
	rules: {
		'no-restricted-properties': [
			'error',
			{
				object: 'process',
				property: 'env',
				message: "Use `import { env } from '~/env'` instead to ensure validated types.",
			},
		],
		'no-restricted-imports': [
			'error',
			{
				name: 'process',
				importNames: ['env'],
				message: "Use `import { env } from '~/env'` instead to ensure validated types.",
			},
		],
	},
})

export default tseslint.config(
	{
		// Globally ignored files
		ignores: [
			//
			'**/*.config.js',
			'.turbo',
			'dist',
			'build',
			'.react-email',
			'not-used',
			'out', //for next js static builds
			'.next',
			'pnpm-lock.yaml',
			'node_modules',
			'.react-email',
		],
	},
	{
		files: ['**/*.js', '**/*.ts', '**/*.tsx'],
		plugins: {
			import: importPlugin,
			'@typescript-eslint': tsPlugin,
			jest: jestPlugin,
		},
		extends: [
			//
			eslint.configs.recommended,
			...tseslint.configs.recommended,
			...tseslint.configs.recommendedTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
			// ...jestPlugin.configs['flat/recommended'],
			// turbo,
			// vitest,
			// airbnb,
			// "eslint:recommended",
			// 'airbnb-typescript',
			// 'plugin:jest/recommended',
			//"plugin:prettier/recommended", // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
			// eslintConfigPrettier,
		],
		rules: {
			'no-console': 'warn',
			'@typescript-eslint/no-unsafe-assignment': 'error',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'tailwindcss/no-custom-classname': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			//   "jest/no-disabled-tests": "warn",
			// "jest/no-focused-tests": "error",
			// "jest/no-identical-title": "error",
			// "jest/prefer-to-have-length": "warn",
			// "jest/valid-expect": "error"
			//
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ prefer: 'type-imports', fixStyle: 'separate-type-imports' },
			],
			'@typescript-eslint/no-misused-promises': [2, { checksVoidReturn: { attributes: false } }],
			'@typescript-eslint/no-unnecessary-condition': [
				'error',
				{
					allowConstantLoopConditions: true,
				},
			],
			'@typescript-eslint/no-non-null-assertion': 'error',
			'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
		},
	},
	{
		linterOptions: { reportUnusedDisableDirectives: true },
		// languageOptions: { parserOptions: { project: ['./tsconfig.json', './**/*/tsconfig.json'] } },
		languageOptions: {
			parserOptions: { project: true }, //, tsconfigRootDir: __dirname
		},
	}
)

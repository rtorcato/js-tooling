// import { fileURLToPath } from "url";

/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("prettier-plugin-tailwindcss").PluginOptions} TailwindConfig */
/** @typedef {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig  } */
const config = {
	singleQuote: true,
	semi: false,
	// we only need prettier plugin for tailwind if we are not in vscode and don't use tailwind plugin
	// plugins: ['@ianvs/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
	plugins: ['@ianvs/prettier-plugin-sort-imports'],
	// tailwindConfig: fileURLToPath(new URL('../../packages/ui/tailwind/web.ts', import.meta.url)),
	// tailwindFunctions: ['cn', 'cva'],
	importOrder: [
		//
		'<TYPES>',
		'^(react/(.*)$)|^(react$)|^(react-native(.*)$)',
		'^(next/(.*)$)|^(next$)',
		'^(expo(.*)$)|^(expo$)',
		'<THIRD_PARTY_MODULES>',
		'',
		'<TYPES>^@acme',
		'^@acme/(.*)$',
		'',
		'<TYPES>^[.|..|~]',
		'^~/',
		'^[../]',
		'^[./]',
	],
	importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
	importOrderTypeScriptVersion: '4.4.0',
}

export default config

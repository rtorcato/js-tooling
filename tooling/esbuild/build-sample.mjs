/*
Sample call to build.mjs in root of project.

*/

import { buildCode, getEntrypointFolders } from './index.mjs'
// import { buildCode, getEntrypointFolders } from '@rtorcato/js-tooling/esbuild/index.mjs'

const folders = await getEntrypointFolders('src')
const libEntryPointsArrays = await Promise.all(folders.map((folder) => getEntryPoints(folder)))
const libEntryPoints = libEntryPointsArrays.flat()
const allEntryPoints = [
	'src/index.ts', // Main entry point
	...libEntryPoints,
	// ...exampleEntryPoints,
]
// Run the build function
buildCode(allEntryPoints).catch((e) => {
	console.error(e)
	process.exit(1)
})

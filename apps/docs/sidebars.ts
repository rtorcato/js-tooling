import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Start here',
      collapsed: false,
      items: [
        'index',
        'guides/getting-started',
        'guides/cli',
        'guides/for-ai-agents',
        'guides/library-style',
      ],
    },
    {
      type: 'category',
      label: 'Configuration Reference',
      items: [
        'reference/biome',
        'reference/commitlint',
        'reference/esbuild',
        'reference/eslint',
        'reference/jest',
        'reference/prettier',
        'reference/semantic-release',
        'reference/tsup',
        'reference/typescript',
        'reference/vitest',
      ],
    },
    {
      type: 'category',
      label: 'Releases',
      items: ['changelog'],
    },
  ],
}

export default sidebars

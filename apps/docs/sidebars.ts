import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Start here',
      collapsed: false,
      items: ['index', 'guides/getting-started'],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      // Landing page at /docs/guides (the nav "Guides" link) — lists every
      // guide as a card so the menu link lands on an index, not the first page.
      link: {
        type: 'generated-index',
        title: 'Guides',
        description:
          'How to set up, audit, and keep a project in sync with the js-tooling standard.',
        slug: '/guides',
      },
      items: [
        'guides/cli',
        'guides/for-ai-agents',
        'guides/library-style',
        'guides/dependabot-strategy',
        'guides/git-flow',
        'guides/public-repo-issue-safety',
        'guides/docs-site',
      ],
    },
    {
      type: 'category',
      label: 'Configuration Reference',
      collapsed: false,
      // Landing page at /docs/reference (the nav "Reference" link) — lists
      // every tool config as a card instead of jumping straight to Biome.
      link: {
        type: 'generated-index',
        title: 'Configuration Reference',
        description: 'The base config for each tool js-tooling ships. Pick a tool below.',
        slug: '/reference',
      },
      items: [
        'reference/biome',
        'reference/changesets',
        'reference/commitlint',
        'reference/esbuild',
        'reference/eslint',
        'reference/jest',
        'reference/oxlint',
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

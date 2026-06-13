import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
  title: 'js-tooling',
  tagline: 'JavaScript and TypeScript tooling for Node.js, React, Next.js, and Vitest.',
  favicon: 'img/favicon.ico',

  url: 'https://rtorcato.github.io',
  baseUrl: '/js-tooling/',

  organizationName: 'rtorcato',
  projectName: 'js-tooling',

  onBrokenLinks: 'warn',

  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          editUrl: 'https://github.com/rtorcato/js-tooling/edit/main/apps/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/docs',
        highlightSearchTermsOnTargetPage: true,
        searchBarShortcutHint: false,
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'js-tooling',
      items: [
        { to: '/docs', position: 'left', label: 'Docs' },
        { to: '/docs/guides/getting-started', position: 'left', label: 'Guides' },
        { to: '/docs/reference/biome', position: 'left', label: 'Reference' },
        {
          href: 'https://github.com/rtorcato/js-tooling',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@rtorcato/js-tooling',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/docs/guides/getting-started' },
            { label: 'CLI', to: '/docs/guides/cli' },
            { label: 'For AI Agents', to: '/docs/guides/for-ai-agents' },
            { label: 'Library style guide', to: '/docs/guides/library-style' },
            { label: 'Changelog', to: '/docs/changelog' },
          ],
        },
        {
          title: 'Resources',
          items: [
            { label: 'GitHub', href: 'https://github.com/rtorcato/js-tooling' },
            { label: 'npm', href: 'https://www.npmjs.com/package/@rtorcato/js-tooling' },
            { label: 'Issues', href: 'https://github.com/rtorcato/js-tooling/issues' },
          ],
        },
        {
          title: 'Sibling projects',
          items: [
            { label: 'js-common', href: 'https://rtorcato.github.io/js-common/' },
            { label: 'browser-common', href: 'https://rtorcato.github.io/browser-common/' },
            { label: 'swift-common', href: 'https://github.com/rtorcato/swift-common' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Issues', href: 'https://github.com/rtorcato/js-tooling/issues' },
            {
              label: 'License (MIT)',
              href: 'https://github.com/rtorcato/js-tooling/blob/main/LICENSE',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Richard Torcato. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.vsDark,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
}

export default config

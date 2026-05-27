import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://rtorcato.github.io',
  base: '/js-tooling',
  integrations: [
    starlight({
      title: 'js-tooling',
      description: 'JavaScript and TypeScript tooling for Node.js, React, Next.js, and Vitest.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/rtorcato/js-tooling' },
      ],
      sidebar: [
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Configuration Reference',
          autogenerate: { directory: 'reference' },
        },
      ],
    }),
  ],
})

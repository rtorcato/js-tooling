---
title: Cypress
description: Cypress E2E preset — a peer to Playwright, sharing the tests/e2e folder.
---

[Cypress](https://www.cypress.io) is an end-to-end testing framework and a peer
to the Playwright preset — pick whichever your team prefers; js-tooling has no
preference. Both keep their specs under `tests/e2e/` so switching runners
doesn't move the folder.

The setup wizard offers Cypress as a `testing.framework` choice alongside
Vitest, Jest, and Playwright.

## Usage

Scaffold it into an existing project:

```bash
npx @rtorcato/js-tooling fix cypress
```

`setup` also offers it interactively. The fixer is **safe-add** — it re-writes
only the deterministic config re-export and never clobbers your custom commands
or specs.

## Generated files

`cypress.config.ts` re-exports the shared base:

```ts
export { default } from '@rtorcato/js-tooling/cypress'
```

The base (`@rtorcato/js-tooling/cypress`) sets:

- `baseUrl` — `CYPRESS_BASE_URL` env var, defaulting to `http://localhost:3000`
- `specPattern` — `tests/e2e/**/*.cy.{js,jsx,ts,tsx}`
- `supportFile` — `cypress/support/e2e.ts`

Also scaffolded:

- `cypress/support/e2e.ts` — loaded before each spec; imports custom commands
- `cypress/support/commands.ts` — where you register `Cypress.Commands.add(...)`
- `tests/e2e/example.cy.ts` — a starter spec

## Scripts

```json
{
  "scripts": {
    "test:e2e": "cypress run",
    "test:e2e:ui": "cypress open"
  }
}
```

## Peer dependency

`setup` adds `cypress` to `devDependencies`; add it manually when running only
the fixer:

```json
{
  "devDependencies": {
    "cypress": "^14"
  }
}
```

---
title: TypeScript
description: TypeScript configuration presets.
---

## Usage

Extend a preset in your `tsconfig.json`:

```json
{
  "extends": "@rtorcato/js-tooling/typescript/base"
}
```

## Available presets

| Export | Use case |
|---|---|
| `typescript/base` | Base config for all projects |
| `typescript/react` | React component libraries |
| `typescript/next` | Next.js apps |
| `typescript/node` | Node.js servers and scripts |
| `typescript/express` | Express.js APIs |

## ts-reset

The wizard copies a `reset.d.ts` that imports `@total-typescript/ts-reset`, giving you stricter array and JSON types out of the box. Available at:

```bash
npx @rtorcato/js-tooling copy reset
```

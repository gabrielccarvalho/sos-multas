# SOS Multas

Micro-SaaS for contesting traffic tickets issued in Natal, RN. Next.js monorepo with shadcn/ui. See `CLAUDE.md` for the architecture and `docs/PROJECT.md` for the product.

## Adding components

Run the shadcn CLI against the `ui` package:

```bash
pnpm dlx shadcn@4.21.0 add button -c packages/ui
```

This places components in `packages/ui/src/components` and their hooks in `packages/ui/src/hooks`.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```

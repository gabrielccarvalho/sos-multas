# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SOS Multas is a micro-SaaS for contesting traffic tickets issued in Natal, Rio Grande do Norte, Brazil. Every user-facing string is Brazilian Portuguese (pt-BR); code, comments, commits and docs are English. Product context, domain glossary, decisions and roadmap live in `docs/PROJECT.md`, imported at the bottom of this file so it is always in context. Update it when a direction changes.

These rules apply to every session and every subagent. When delegating with the Agent tool, restate the constraints that matter for that task in the prompt (Base UI not Radix, Hugeicons not lucide, pt-BR copy, run shadcn against `packages/ui`) rather than assuming the subagent inferred them.

## Commands

Everything runs from the repo root through Turborepo. pnpm 10 (`packageManager` is pinned) and Node >= 20.

| Command | What it does |
| --- | --- |
| `pnpm dev` | `next dev` for `apps/web` on http://localhost:3000 |
| `pnpm build` | `next build` (only `web` has a build task; `ui` is consumed as source) |
| `pnpm typecheck` | `tsc --noEmit` in every package. This is the real gate. |
| `pnpm lint` | ESLint 9 flat config. `eslint-plugin-only-warn` downgrades every rule to a warning, so lint never fails. Read the output anyway. |
| `pnpm format` | `prettier --write` inside each package |
| `pnpm test` | Vitest in every package that defines a `test` script (today only `web`, files `lib/**/*.test.ts`) |
| `pnpm db:up` / `pnpm db:down` | Start or stop the local Postgres 17 container from `docker-compose.yml`. Connection string in `apps/web/.env.example`; copy it to `apps/web/.env.local` |

Scope to one workspace with `pnpm --filter web <script>` or `pnpm --filter @workspace/ui <script>`.

Run one test file with `pnpm --filter web exec vitest run lib/domain/deadlines.test.ts`.

### Adding shadcn components

```bash
pnpm dlx shadcn@4.21.0 add <name> -c packages/ui
```

Run it against `packages/ui`, not `apps/web`. The ui package's `components.json` resolves every alias to `@workspace/ui/*`, so companion hooks (for example `use-mobile`, which `sidebar` imports) land in `packages/ui/src/hooks` where the component can reach them. Running from `apps/web` writes hooks to `apps/web/hooks` and breaks that import. Pin the CLI to the `shadcn` version already in `packages/ui/package.json` so the generated code matches the installed base stylesheet. Use `-c apps/web` only for blocks or pages that belong in the app.

All 61 registry components for this style are already installed. Registry code sometimes ships with type errors against the installed primitives (the spinner did); fix them in place, we own the source.

## Architecture

pnpm workspace (`apps/*`, `packages/*`) orchestrated by Turborepo. Internal packages use the `@workspace/*` scope and `workspace:*` versions.

- `apps/web` is the Next.js 16 app (App Router, React 19, React Server Components). It owns routes, `app/layout.tsx`, fonts, the theme provider and anything app-specific under `components/`, `hooks/`, `lib/`. The `@/` alias maps to the app root.
- `packages/ui` (`@workspace/ui`) is the design system: shadcn components, `cn`, shared hooks and the single Tailwind stylesheet. There is no build step. `package.json` `exports` maps `./components/*`, `./hooks/*`, `./lib/*`, `./globals.css` and `./postcss.config` straight to files under `src/`, and `apps/web/next.config.ts` lists it in `transpilePackages`. Import as `@workspace/ui/components/button`.
- `packages/eslint-config` and `packages/typescript-config` hold the shared configs. Each workspace's `eslint.config.js` and `tsconfig.json` extend them; the root `.eslintrc.js` only carries ignore patterns.

Keep app-specific UI in `apps/web/components`. Only put app-agnostic design-system pieces in `packages/ui`.

`pnpm-workspace.yaml` has an `allowBuilds` list. pnpm 10 blocks dependency postinstall scripts unless listed there, so a new dependency that needs one (`sharp`-style native builds) must be added to that list or it silently ships unbuilt.

### Styling pipeline

Tailwind v4, CSS-first, no `tailwind.config`. The only stylesheet is `packages/ui/src/styles/globals.css`:

- It imports `tailwindcss`, `tw-animate-css` and `shadcn/tailwind.css`. The last one comes from the `shadcn` npm package and defines the custom variants the components rely on (`data-open:`, `data-closed:`, accordion keyframes, and so on).
- `@source` directives point at `apps/**/*.{ts,tsx}` and the package's own `src`, so class scanning covers the app without any per-app Tailwind setup.
- Theme tokens are plain CSS variables on `:root` and `.dark`, then mapped into Tailwind through `@theme inline` (`--color-primary: var(--primary)`). A new token has to be added in both places. The primary colour is a lime green (oklch hue ~130).
- Dark mode is class-based (`@custom-variant dark`). `apps/web/components/theme-provider.tsx` wraps `next-themes` and adds a dev hotkey: pressing `d` outside an input toggles the theme.
- `apps/web/postcss.config.mjs` re-exports the ui package's PostCSS config. The app imports the CSS once, in `app/layout.tsx`, as `@workspace/ui/globals.css`.

Fonts are loaded with `next/font` in `app/layout.tsx` and exposed as CSS variables on `<html>`: `--font-sans` is Public Sans, `--font-heading` is Merriweather, `--font-mono` is Geist Mono. `--font-sans` and `--font-heading` are re-declared inside `@theme inline`, which is what makes the `font-sans` and `font-heading` utilities work.

Prettier runs `prettier-plugin-tailwindcss` with `tailwindStylesheet` pointed at that `globals.css` and sorts classes inside `cn()` and `cva()` calls too.

### shadcn specifics (this is not the Radix flavour)

Both `components.json` files (`apps/web`, `packages/ui`) describe the same setup: style `base-nova`, base colour `neutral`, CSS variables on, RSC on.

- Primitives come from **Base UI** (`@base-ui/react/<component>` subpath imports), not Radix. Base UI names its parts differently (`Backdrop` not `Overlay`, `Popup` not `Content`, a `Positioner` around floating content) and composes with a `render` prop instead of `asChild`. Snippets copied from the Radix-flavoured shadcn docs will not type-check here; run `pnpm dlx shadcn@4.21.0 docs <component>` or read the installed source.
- Icons are **Hugeicons**: `HugeiconsIcon` from `@hugeicons/react` rendering an icon from `@hugeicons/core-free-icons`. Do not add `lucide-react`.
- `cn` is the `cn` npm package (a compiled drop-in for clsx + tailwind-merge). `packages/ui/src/lib/utils.ts` re-exports it, but the components import it directly from `"cn"`.
- Components that need browser APIs already carry `"use client"`. Every component root sets a `data-slot` attribute, and several styles key off it (`in-data-[slot=button-group]:`), so keep it when wrapping or extending.
- `message-scroller` and `questionnaire` depend on runtime helpers from `@shadcn/react`.
- The `chart` component wraps `recharts`, `calendar` wraps `react-day-picker` + `date-fns`, `carousel` wraps `embla-carousel-react`, `command`/`combobox` wrap `cmdk`, `resizable` wraps `react-resizable-panels`, `input-otp` wraps `input-otp`. All of these live in `packages/ui/package.json`.

### Next.js 16

This Next.js version has breaking changes relative to training data. Before writing routing, caching, data-fetching, form or middleware code, read the matching guide in `apps/web/node_modules/next/dist/docs/` (pnpm does not hoist it to the root). `01-app/01-getting-started`, `01-app/02-guides` and `01-app/03-api-reference` are the relevant folders. The root `AGENTS.md` carries the Next.js-managed agent rules and is imported here:

@AGENTS.md

## Conventions

- pt-BR copy in the UI; English everywhere else.
- Prettier: no semicolons, double quotes, 2-space indent, 80 columns, ES5 trailing commas.
- TypeScript is `strict` with `noUncheckedIndexedAccess`, so indexing an array or record yields `T | undefined`. Packages resolve modules with `NodeNext`; the Next app uses `Bundler`.
- Components are plain functions with a `data-slot`, props typed from the underlying primitive (`DialogPrimitive.Root.Props`) and variants built with `cva`. Follow that shape for new design-system pieces.

## Product context

@docs/PROJECT.md

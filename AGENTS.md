# BimmerDisco

Expo (SDK 57) app that controls BMW F-series lights over UDS. Read `docs/PLAN.md` first: it holds all decisions, the architecture and the milestone progress. Update its milestone row and Log after every task. `PROTO/` is gitignored reference material only.

## Overrides of the global rules

This project is a custom branded dark UI, so the global "native-looking iOS" rules are replaced:

- UI kit: gluestack UI + NativeWind with design tokens. Do not use `PlatformColor` or native-looking controls; do not hardcode hex values outside the token files. The HIG type scale is replaced by the design tokens.
- Keep native for behaviour only: `@react-navigation` native-stack navigation, `formSheet` sheets, `Alert.alert` confirmations, haptics, keyboard handling.
- Icons: `phosphor-react-native`, not SF Symbols.
- State: Zustand (persisted) for UI state and XState v5 for the session machine. No React Query (there is no server).
- i18n: i18next + react-i18next, EN + PL. Every string via `t()`; add keys to both `en.json` and `pl.json`.
- Tests: jest-expo (unit, byte-snapshot, model-based, RNTL) and Maestro for E2E in Demo mode. Coverage >= 90% on `src/protocol`, `src/link`, `src/domain`.

## Layout

Routes live in `app/` (thin). Code lives in `src/` (`transport`, `link`, `protocol`, `domain`, `simulator`, `data/generated`, `stores`, `ui`, `features`, `i18n`) with alias `@/*` -> `src/*`. Do not edit `src/data/generated`.

## Commands

Package manager: pnpm (`lightningcss` is pinned via `overrides` in `pnpm-workspace.yaml`; never add an npm lockfile). `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:coverage`. Pre-commit runs lint-staged (eslint, prettier, tsc).

## Safety

Forced control must always be undone (see Safety policy in `docs/PLAN.md`). Sentry is the only network use (user-initiated problem reports plus crash reports), with no other analytics.

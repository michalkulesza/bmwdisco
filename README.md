# BimmerDisco

An Expo app for controlling BMW F-series lights over UDS, with an in-process Demo vehicle for development. Includes EN/PL translations, custom presets, and automatic restoration of forced light control on stop, error, disconnect, and backgrounding.

Hardware support and individual lighting mappings are still being validated. See [the project plan](docs/PLAN.md) for adapter support, safety requirements, known limitations, and milestone status.

## Development

Use Node.js and pnpm, then install dependencies:

```sh
pnpm install
pnpm start
```

Native adapters require a development build rather than Expo Go. With the appropriate Android SDK or macOS/Xcode setup, run `pnpm android` or `pnpm ios`. Demo mode uses the simulator and does not need an OBD adapter.

Sentry is optional. Copy `.env.example` to `.env` and configure your own values if needed; leave the DSN empty to disable reports. Keep credentials and local environment files out of Git.

```sh
pnpm typecheck
pnpm lint
pnpm test -- --runInBand
pnpm test:coverage -- --runInBand
pnpm gen:data:check
```

Routes live in `app/`; application code lives in `src/`. Edit ECU source data in `data/ecu/` and regenerate with `pnpm gen:data`; do not edit `src/data/generated/` directly. Local research directories are optional, ignored, and unnecessary for normal builds and tests.

Read [AGENTS.md](AGENTS.md) and [docs/PLAN.md](docs/PLAN.md) before contributing. Preserve the restoration safety policy and add user-facing strings to both locales.

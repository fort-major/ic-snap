# MSQ - Safe ICP Wallet

Privacy-focused MetaMask snap for interacting with the Internet Computer (ICP)

*[Join Our Telegram](https://t.me/fortmajoricp)*

*[Subscribe to our X](https://x.com/msqwallet)*

## Documentation

1. [MSQ's Architecture](./documentation/architecture.md)
2. [How to integrate MSQ into your Dapp](./documentation/integration.md)

## Audits

This software's code was audited by Consensys Diligence at March of 2024. All the findings were addressed immediately and with great care. You can read the report [here](https://consensys.io/diligence/audits/2024/03/msq-snap/).

## Local development

This project is managed with `pnpm` and `turborepo`.

* `npm i -g pnpm`
* `pnpm i -g turbo dotenv-cli`

### Install

* `pnpm install`

### Environment variables

You would need files called `.env.dev` and `.env.prod` in the root folder. Set their content as `example.env` says.
If you change any devserver host (snap, snap website or demo website), then you should also change it in `.env.dev`.
DFX env variables (starting with `CANISTER_ID_`) are propagated to vite automatically. The same goes for env variables starting with `MSQ_`.

### Project structure

* `/packages/snap` contains the MSQ Snap module;
* `/apps/site` contains the MSQ companion dapp;
* `/packages/client` contains the client library used by third party developers to integrate with MSQ;
* `/packages/shared` contains a library with shared utility functions, types and constants;
* `/apps/demo` contains a demo dapp project that showcases the integration;
* `/apps/nns` contains a complete set of nns-canisters for development purposes.

### Run locally

* `dfx start` - (in a separate terminal window)
* `dfx extension install nns` - install nns extension to your dfx
* `cd apps/nns && dfx nns install && cd ../..` - install nns canisters
* `pnpm run dev:gen` - generates javascript declaration files
* `pnpm run dev:build` - builds frontends for dev network
* `pnpm run dev:deploy` - deploys all canisters locally (please run this command after you deploy to the mainnet to rebuild the env vars)
  * if this command fails because of locked `Cargo.toml`, run `pnpm run cargo:repair` and repeat
* `pnpm run dev` - starts a development server with both: MSQ website and Demo project

### Test

Tests only work when the project is built for dev (`pnpm run dev:build`)

* `pnpm run test`

### Lint with eslint

* `pnpm run lint`

### Format with prettier

* `pnpm run format`

### Render documentation with typedoc

* `pnpm run doc`

### Prod deployment

* `pnpm run prod:build`
* `pnpm run prod:deploy`

### Publishing

*Note: Make sure you're publishing `packages/shared` before `packages/client`, because the second depends on the first being available at the registry before it can be published as well.*

* (opt) `npm login` - don't forget to log in to your npm account
* `pnpm run pub`

## Contribution

Feel free to open an issue if you found a bug or want to suggest a feature.

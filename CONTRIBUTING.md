# Contributing to reagent

Thanks for taking the time to contribute. This document covers how to get set up and what makes a good pull request.

## Getting set up

1. Fork the repo and clone your fork.
2. Follow the [Getting started](README.md#getting-started) section of the README to install dependencies and configure `.env`.
3. Confirm everything runs: `./scripts/dev.sh start` then `./scripts/dev.sh status`.

## Making a change

- Create a branch off `main`: `git checkout -b your-name/short-description`.
- Keep pull requests focused — one logical change per PR is much easier to review than a bundle of unrelated fixes.
- Match the existing code style in the file you're editing. This project doesn't currently run a formatter/linter in CI, so consistency with surrounding code is the bar.
- Run a type-check before opening a PR:
  ```bash
  npx tsc -p tsconfig.app.json --noEmit
  ```
- If your change affects the backend, restart the dev server (`./scripts/dev.sh restart`) and confirm `/tmp/reagent-dev.log` is free of new errors.

## Commit messages

Write commit messages that explain *why*, not just *what* — the diff already shows what changed. Reference an issue number if one exists.

## Pull requests

- Describe what the PR does and why, and call out anything you're unsure about.
- Screenshots are appreciated for any UI change.
- Never include real API keys, tokens, or `.env` contents in a commit or PR description.

## Reporting bugs / requesting features

Please [open an issue](https://github.com/hritvikgupta/reagent/issues/new/choose) using the appropriate template. For bugs, include steps to reproduce and what you expected to happen instead.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.

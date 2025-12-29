# Continuous Integration

Running Biome in a CI environment is easy. Check out the following examples for some inspiration.

### `biome check` VS `biome ci`


Biome offers two CLI commands to run all checks: `biome check` and `biome ci`, however the latter should be used in CI (Continuous Integration) environments.

Compared to the `check` command, the `ci` command:

* Doesn’t provide any `--write`/`--fix` option.
* Integrates better with specific runners. For example, when run on GitHub, the diagnostics are printed using the GitHub annotations.
* Allows controlling the number of threads.
* When VCS integration is enabled, it uses the `--changed` flag instead of `--staged`, because a remote repository doesn’t have the concept of “staged files”.

With time, the `ci` command will receive more and more features.

## GitHub Actions


We provide a first-party [GitHub Action](https://github.com/marketplace/actions/setup-biome) to setup Biome in your runner.
Here’s what a simple workflow might look like:

pull\_request.yml

```
name: Code quality

on:

push:

pull_request:

jobs:

quality:

runs-on: ubuntu-latest

permissions:

contents: read

steps:

- name: Checkout

uses: actions/checkout@v5

with:

persist-credentials: false

- name: Setup Biome

uses: biomejs/setup-biome@v2

with:

version: latest

- name: Run Biome

run: biome ci .
```

If your Biome configuration has external dependencies (e.g., extends a config from a package), you’ll need to setup Node.js and install dependencies using your preferred package manager before running Biome:

```
- name: Setup Node.js

uses: actions/setup-node@v4

with:

node-version: 22 # or your preferred version

cache: "npm" # or 'yarn', 'pnpm'

- name: Install dependencies

run: npm ci # or yarn install --frozen-lockfile, pnpm install --frozen-lockfile
```

### Third-party actions


These are actions maintained by other communities, that you use in your runner:

* [reviewdog-action-biome](https://github.com/marketplace/actions/run-biome-with-reviewdog): run Biome with reviewdog and make comments and commit suggestions on the pull request.

pull\_request.yml

```
name: reviewdog

on: [pull_request]

jobs:

biome:

name: runner / Biome

runs-on: ubuntu-latest

permissions:

contents: read

pull-requests: write

steps:

- uses: actions/checkout@v5

- uses: mongolyy/reviewdog-action-biome@v1

with:

github_token: ${{ secrets.github_token }}

reporter: github-pr-review
```

## GitLab CI


Below is an example configuration:

.gitlab-ci.yml

```
# Define pipeline stages

stages:

- quality

# Lint job configuration: runs code quality checks using Biome

lint:

image:

name: ghcr.io/biomejs/biome:latest  # Use the latest Biome Docker image

entrypoint: [""]                    # This is required for the image to work in GitLab CI

stage: quality                        # Run in the quality stage

script:

- biome ci --reporter=gitlab --colors=off > /tmp/code-quality.json

- cp /tmp/code-quality.json code-quality.json

artifacts:

reports:

codequality:

- code-quality.json    # Collect the code quality report artifact

rules:

- if: $CI_COMMIT_BRANCH    # Run job for commits on branches

- if: $CI_MERGE_REQUEST_ID # Run job for merge requests
```

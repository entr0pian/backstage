# [Backstage](https://backstage.io)

This is your newly scaffolded Backstage App, Good Luck!

To start the app, run:

```sh
yarn install
yarn start
```

## Onboard Service template

Milestone 1 of the platform's Backstage integration (see `BACKSTAGE.md` in the
`platform-architecture` repo) — lets a developer onboard a new service without
touching Kubernetes or `application-repositories` by hand.

```
Backstage → Create → Onboard Service
    ↓
Backstage renders a Component CR and opens a PR against
entr0pian/application-repositories
    ↓
Developer reviews/merges the PR
    ↓
Existing GitOps flow takes over: component-operator reconciles the
Component into an owned GitHubRepository + ScaffoldRequest
```

Backstage only ever renders a file and opens a PR — it never talks to
Kubernetes or GitHub repository-provisioning APIs directly. See
`PLATFORM_API_ARCHITECTURE.md` in `platform-architecture` for what happens
after the PR merges.

- **Template location**: `templates/onboard-service/template.yaml`
  (+ `skeleton/component.yaml`, renamed to `<name>.yaml` by an `fs:rename`
  step — `fetch:template` templates file contents, not file names),
  registered as a catalog `Template` location in `app-config.yaml`.
- **Destination repo**: `entr0pian/application-repositories`, via a PR from
  branch `backstage/onboard-<name>` (uses the built-in
  `publish:github:pull-request` scaffolder action — no custom backend plugin).
- **Destination path**: `platform/registry/<name>.yaml` — a `Component` CR,
  applied verbatim once merged (no Helm chart/values involved).

Example rendered manifest for `name=order-service`, `owner=order-team`,
`visibility=public`, `scaffoldTemplate=golang-service`,
`scaffoldVersion=0.3.0`:

```yaml
apiVersion: platform.taskapp.io/v1alpha1
kind: Component
metadata:
  name: order-service
  labels:
    platform.taskapp.io/component: order-service
spec:
  owner: order-team
  repository:
    name: order-service
    visibility: public
  scaffold:
    template: golang-service
    version: "0.3.0"
```

### Required configuration

GitHub auth is the existing `integrations.github` block in `app-config.yaml`
— nothing new to configure for this template. It needs one environment
variable, read at startup (never commit the token itself):

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | PAT (or GitHub App token) with `contents:write` + `pull_requests:write` on `entr0pian/application-repositories`, used by both the catalog GitHub integration and the scaffolder's `publish:github:pull-request` action |

### Running locally

```sh
export GITHUB_TOKEN=<a token with access to entr0pian/application-repositories>
yarn install
yarn start
```

Then open `http://localhost:3000/create`, choose **Onboard Service**, fill in
the form, and submit — Backstage returns a link to the opened pull request.

### Testing the flow

- **Template rendering** (no network, no Backstage runtime needed):
  ```sh
  node --test templates/onboard-service/render.test.mjs
  ```
  Verifies the skeleton renders the exact manifest shape above from known
  inputs, and that the name field's DNS-style validation accepts
  `order-service`/`payments`/`customer-api` and rejects
  `Payments Service`/`My_Service`/`TEST SERVICE`.
- **End-to-end**: run the app locally as above, submit the form with a
  throwaway component name, confirm the PR lands on
  `entr0pian/application-repositories` with the expected
  `platform/registry/<name>.yaml`, then close it without merging.

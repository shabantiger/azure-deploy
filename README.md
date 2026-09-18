# azure-deploy ☁️

[![CI](https://github.com/your-org/azure-deploy-action/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/azure-deploy-action/actions/workflows/ci.yml)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-azure--deploy-blue?logo=github)](https://github.com/marketplace/actions/azure-deploy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**One workflow addition = full production Azure deployment.**

`azure-deploy` auto-detects your application's stack, provisions all Azure infrastructure using Bicep, builds and pushes your Docker image to Azure Container Registry, and deploys to Azure Container Apps — zero manual Azure portal interaction required.

---

## ✨ Features

- 🔍 **Auto-detect stack** — Node.js, Python, fullstack (Node+React), or static
- 🏗️ **Provision infrastructure** — ACR, Log Analytics, Container Apps Environment, Managed Identity
- 🐳 **Auto-generate Dockerfiles** — sensible defaults for Node and Python if you don't have one
- 🚀 **Deploy to Azure Container Apps** — with HTTP autoscaling and revision tracking
- 🐘 **Optional PostgreSQL** — Flexible Server with firewall rules and auto-injected `DATABASE_URL`
- 🌐 **Static Web Apps** — Free SKU for static sites
- 📌 **GitHub Deployments** — annotates your repo's deployment history
- 💬 **Slack notifications** — success and failure alerts with deep links
- ♻️ **Idempotent** — re-runs safely update existing resources

---

## 🚀 Quick Start

Add this to `.github/workflows/deploy.yml` in your repository:

```yaml
- uses: your-org/azure-deploy-action@v1
  with:
    azure-credentials: ${{ secrets.AZURE_CREDENTIALS }}
    app-name: my-app
    location: eastus
    environment: production
```

That's it. Push to `main` and your app is live on Azure.

---

## 📋 Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `azure-credentials` | ✅ | — | Azure service principal JSON |
| `app-name` | ✅ | — | Application name prefix for all Azure resources |
| `resource-group` | | `rg-{app-name}-prod` | Azure resource group name |
| `location` | | `eastus` | Azure region |
| `stack` | | `auto` | `node` \| `python` \| `static` \| `fullstack` \| `auto` |
| `env-vars` | | — | `KEY=VALUE` pairs (newline-separated) |
| `postgres` | | `false` | Provision PostgreSQL Flexible Server |
| `postgres-sku` | | `Burstable_B1ms` | PostgreSQL SKU |
| `cpu` | | `0.5` | Container CPU in vCPUs |
| `memory` | | `1Gi` | Container memory |
| `min-replicas` | | `1` | Minimum replica count |
| `max-replicas` | | `3` | Maximum replica count |
| `custom-domain` | | — | Custom domain for the app |
| `acr-name` | | auto-generated | Azure Container Registry name |
| `docker-file` | | `Dockerfile` | Path to Dockerfile |
| `environment` | | `production` | Deployment environment name |
| `notify-slack` | | — | Slack webhook URL for notifications |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `app-url` | The URL of the deployed application |
| `acr-name` | Azure Container Registry name used |
| `resource-group` | Azure resource group name |
| `revision` | Active Container App revision name |
| `deploy-time` | Deployment timestamp (ISO 8601) |

---

## 🔍 Stack Detection Matrix

| Files present | Detected stack | Container port |
|--------------|---------------|---------------|
| `package.json` only | `node` | 3000 |
| `package.json` + `client/` or `frontend/` | `fullstack` | 3000 |
| `requirements.txt` or `pyproject.toml` | `python` | 8000 |
| `index.html`, `dist/`, or `public/` | `static` | Static Web App |
| Any of the above + `Dockerfile` | (stack detected) + existing Dockerfile used | as above |

> **Tip:** If `stack: auto` doesn't detect correctly, set `stack` explicitly.

---

## 🔐 Creating an Azure Service Principal

```bash
az ad sp create-for-rbac \
  --name "github-actions-my-app" \
  --role contributor \
  --scopes /subscriptions/<YOUR_SUBSCRIPTION_ID> \
  --sdk-auth
```

Copy the JSON output and add it as a GitHub Actions secret named `AZURE_CREDENTIALS`.

The JSON will look like:
```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

---

## 📖 Examples

### Node.js App

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: your-org/azure-deploy-action@v1
        with:
          azure-credentials: ${{ secrets.AZURE_CREDENTIALS }}
          app-name: my-node-app
          location: eastus
          env-vars: |
            NODE_ENV=production
            API_URL=https://api.example.com
```

### Python (FastAPI/Flask) App

```yaml
name: Deploy Python

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: your-org/azure-deploy-action@v1
        with:
          azure-credentials: ${{ secrets.AZURE_CREDENTIALS }}
          app-name: my-python-api
          stack: python
          location: westeurope
          cpu: '1'
          memory: 2Gi
          min-replicas: 2
          max-replicas: 10
```

### Fullstack App with PostgreSQL

```yaml
name: Deploy Fullstack

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: your-org/azure-deploy-action@v1
        id: deploy
        with:
          azure-credentials: ${{ secrets.AZURE_CREDENTIALS }}
          app-name: my-fullstack-app
          stack: fullstack
          postgres: true
          postgres-sku: GeneralPurpose_D2s_v3
          notify-slack: ${{ secrets.SLACK_WEBHOOK_URL }}
          env-vars: |
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            REDIS_URL=${{ secrets.REDIS_URL }}

      - name: Print outputs
        run: |
          echo "App URL: ${{ steps.deploy.outputs.app-url }}"
          echo "Revision: ${{ steps.deploy.outputs.revision }}"
```

### Static Site

```yaml
name: Deploy Static Site

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: npm ci && npm run build

      - uses: your-org/azure-deploy-action@v1
        with:
          azure-credentials: ${{ secrets.AZURE_CREDENTIALS }}
          app-name: my-static-site
          stack: static
          location: eastus
```

---

## 🏗️ Infrastructure Provisioned

Every deployment (except `static`) provisions:

| Resource | SKU | Purpose |
|----------|-----|---------|
| Azure Container Registry | Basic | Store Docker images |
| Log Analytics Workspace | PerGB2018 (30-day retention) | Centralized logs |
| Container Apps Environment | Consumption | Serverless container hosting |
| Managed Identity | User-assigned | Secure ACR pull (no credentials) |
| Container App | Consumption | Your application |

When `postgres: true`:

| Resource | SKU | Purpose |
|----------|-----|---------|
| PostgreSQL Flexible Server | Configurable (default: Burstable_B1ms) | Database |

For `static` stack:

| Resource | SKU | Purpose |
|----------|-----|---------|
| Static Web App | Free | Static site hosting |

---

## 🤝 Contributing

1. Fork the repo
2. `npm install && npm run build`
3. Make your changes in `src/`
4. Run `npm test` and `npm run lint`
5. Run `npm run build` and commit `dist/`
6. Open a pull request

---

## 📄 License

MIT — see [LICENSE](LICENSE).

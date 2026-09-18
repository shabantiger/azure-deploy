# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Auto-detection of application stack (node, python, static, fullstack)
- Azure infrastructure provisioning via Bicep templates:
  - Azure Container Registry (Basic SKU)
  - Log Analytics Workspace
  - Azure Container Apps Environment
  - User-assigned Managed Identity with ACR Pull rights
  - Azure Container Apps with HTTP scaling
  - PostgreSQL Flexible Server (optional)
  - Azure Static Web Apps (for static stacks)
- Automatic Dockerfile generation for Node.js and Python stacks
- Docker image build and push to Azure Container Registry
- Revision polling until active
- Environment variables injection as Container App secrets
- Custom domain binding support
- GitHub Deployment API annotation
- Slack webhook notifications on success and failure
- Full TypeScript strict mode
- Idempotent deployments (re-run updates existing resources)
- Comprehensive action inputs/outputs

[Unreleased]: https://github.com/your-org/azure-deploy-action/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/azure-deploy-action/releases/tag/v1.0.0

# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - 2026-02-13

### Changed
- Pivoted from Partner API to Enterprise Gateway API endpoints.
- Replaced Partner toolset with Enterprise-focused MCP tools.
- Updated environment model from token-based auth to `userid/password` credentials.

### Added
- Retry/backoff for transient gateway failures (`429`, `5xx`, network errors).
- Redacted structured logging controls (`GUPSHUP_LOG_LEVEL`, `GUPSHUP_REDACT_LOGS`).
- Local smoke runner (`npm run smoke -- ...`) for incremental live checks.
- CI workflow for build/test/package checks.
- Security policy (`SECURITY.md`).

### Removed
- Partner-specific token manager, rate limiter, and related tool modules.

## [0.1.0] - 2026-02-13

### Added
- Initial public release targeting Partner API with 13-tool MCP surface.

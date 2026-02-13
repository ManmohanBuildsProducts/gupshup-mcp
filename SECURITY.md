# Security Policy

## Supported Versions

Only the latest `master` branch and latest tagged release are supported.

## Reporting A Vulnerability

Do not open public issues for security bugs.

Report privately by email to: `security@manmohanbuildsproducts.com`.

Include:
- Summary of the issue
- Steps to reproduce
- Impact assessment
- Affected version/commit
- Any proof-of-concept details

## Response Targets

- Initial acknowledgement: within 3 business days
- Triage decision: within 7 business days
- Remediation timeline: shared after triage

## Secret Handling Guidance

- Never commit files containing credentials (`.env`, `.env.*`).
- Use `.env.example` as the template only.
- Keep `GUPSHUP_REDACT_LOGS=true` in non-local environments.
- Rotate Gupshup credentials immediately if leaked.

## Scope

This policy covers the `gupshup-mcp` repository, including:
- MCP server runtime
- Gateway request handling
- Logging and redaction
- Packaging and release artifacts

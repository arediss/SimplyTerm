# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.6.x   | :white_check_mark: |
| < 0.6   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in SimplyTerm, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

Instead, please:

1. Email the maintainers directly or use [GitHub's private vulnerability reporting](https://github.com/arediss/SimplyTerm/security/advisories/new)
2. Include a clear description of the vulnerability
3. Provide steps to reproduce if possible
4. Allow reasonable time for a fix before public disclosure

## What Qualifies

- Vault encryption weaknesses
- Credential leakage (passwords, SSH keys, tokens)
- Remote code execution
- Authentication bypass
- Plugin sandbox escape

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix release**: As soon as possible, depending on severity

## Security Features

SimplyTerm takes security seriously:

- AES-256 encrypted vault for credentials and SSH keys
- Multiple unlock methods (master password, PIN, FIDO2, biometrics)
- Auto-lock with configurable timeouts
- Maximum security mode (re-lock after each connection)
- Host key verification (MITM protection)
- All data stored locally — nothing is sent to external servers

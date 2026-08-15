# Security Policy

## Supported versions

Security fixes target the latest published Community snapshot. A release may
identify additional supported versions in its release notes; otherwise older
snapshots should be treated as unsupported.

## Report a vulnerability privately

Use the repository's **Security → Report a vulnerability** form (GitHub Private
Vulnerability Reporting). If that facility is unavailable, email
**support@nexusclaw.cn**. This mailbox is the public fallback security contact
operated by 上海鲁云互联网科技有限公司. Do not include a
credential or exploit secret in the email subject.
Do not open a public issue and do not include credentials, personal data,
customer identifiers or exploit details in public channels.

Include only what is necessary to reproduce the issue:

- affected snapshot/version and deployment shape;
- impact and required privileges;
- minimal reproduction steps;
- sanitized logs or proof of concept;
- whether the issue may expose credentials, personal data or proprietary code.

Do not test against systems or data you do not own or have explicit permission
to assess. Do not degrade availability, access other users' data or retain data
beyond the minimum needed for a responsible report.

## Response process

Maintainers will acknowledge the private report, triage scope and severity,
coordinate a fix and disclosure window, and publish remediation guidance when
safe. Exact response times are not promised until the operating team publishes
and measures a service-level policy.

For suspected credential, personal-data or proprietary-source exposure, the
incident owner must stop synchronization and publication, preserve evidence,
revoke affected credentials, involve security and legal owners, and assess
downstream copies. Deleting a release or rewriting Git history does not make
already published material private again.

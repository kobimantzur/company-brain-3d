# Security

## Scope

This is a client-side rendering component. It takes a JSON tree and draws it — no network calls, no
storage, no eval. The realistic issues are:

- a crafted `brain.json` causing a crash or a hang (deep recursion, enormous sibling counts)
- XSS through node `title` / `description` if a consumer bypasses React's escaping
- the standalone bundle's `?src=` parameter fetching an attacker-supplied URL

## Reporting

Open a [private security advisory](https://github.com/kobimantzur/company-brain-3d/security/advisories/new).
Please don't file a public issue for anything exploitable.

I'll acknowledge within a few days and aim to ship a fix or a mitigation within two weeks.

## For consumers

- Validate untrusted data against [`brain.schema.json`](brain.schema.json) before rendering it.
- `?src=` on the standalone bundle fetches whatever URL you give it. Don't pass user input to it
  without an allowlist.

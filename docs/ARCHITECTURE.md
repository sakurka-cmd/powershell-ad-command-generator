# PowerShell AD Command Generator — Project Documentation

## 1. Overview

PowerShell AD Command Generator is a single-page web application that helps IT administrators generate PowerShell commands for common Active Directory management tasks. The primary goal is to reduce errors in command construction by providing structured forms that output syntactically correct, ready-to-paste PowerShell code.

### Problem Statement

AD administrators frequently need to construct PowerShell commands with correct parameter syntax. Common pain points:

- Forgetting required parameters (e.g., `-Identity`, `-Members`)
- Incorrect quoting of distinguished names and usernames
- Not knowing which cmdlets are available for specific tasks
- Needing to target multiple domains in multi-domain environments
- Risk of typos in group names, OU paths, and usernames

### Solution

A form-based generator where the user fills in fields (group name, usernames, OU paths) and the tool constructs the complete command string. No AD connection needed — the tool runs entirely in the browser.

---

## 2. Technology Choices

### 2.1 Next.js 16 with Static Export

**Decision:** Use Next.js with `output: "export"` to generate a purely static site.

**Rationale:**
- The application has no server-side logic — no API routes, no database, no authentication
- Static export produces a self-contained directory of HTML/CSS/JS files
- No Node.js runtime required on production server
- Python's built-in `http.server` is sufficient for serving static files
- Total production footprint: ~1.3 MB in 44 files vs. hundreds of MB for a Node.js runtime

**Trade-offs:**
- No server-side rendering (SSR) — but the page is a single SPA with no SEO requirements
- No API routes — but all logic is client-side command generation
- No incremental static regeneration — but content never changes between deploys

### 2.2 Single-File Architecture

**Decision:** All application code (15 use cases, UI layout, configuration) lives in a single `page.tsx` file.

**Rationale:**
- Each use case is a self-contained component with its own state, form fields, and command generation logic
- No shared state between use cases (no global context needed beyond domain config)
- Adding a new use case requires adding ~30-50 lines to one file
- The file is ~1400 lines but well-organized with clear section separators
- Eliminates routing complexity (no `app/[id]/page.tsx` files)
- Faster to navigate and maintain for a tool of this scope

**When to refactor:**
- If the file exceeds ~3000 lines (approximately 30+ use cases)
- If use cases need shared state (e.g., form presets stored centrally)
- If different teams maintain different use cases

### 2.3 shadcn/ui + Tailwind CSS 4

**Decision:** Use shadcn/ui component library with Tailwind CSS 4 and a dark theme.

**Rationale:**
- shadcn/ui provides copy-paste components (not npm dependencies) — only used components are bundled
- Consistent, accessible UI components (Button, Card, Input, Select, Checkbox, Badge, Tabs)
- Tailwind CSS 4 enables rapid styling without writing custom CSS
- Dark theme is appropriate for PowerShell/terminal-oriented tooling
- Color scheme: blue accents (#3b82f6) on dark backgrounds (#0a0a0a/#1a1a1a) — inspired by PowerShell ISE

### 2.4 Python http.server for Production

**Decision:** Serve static files with `python3 -m http.server 8080` instead of nginx or Node.js.

**Rationale:**
- The target server (158.46.44.74) has Python but limited resources
- No need for TLS termination, caching, or URL rewriting (single-page static site)
- Zero configuration required
- Sufficient for internal tool usage (not public-facing)
- Can be replaced with nginx if performance becomes an issue

**Alternative considered:** Caddy (auto-TLS, single binary) — rejected because the server has restricted internet access and no domain name.

### 2.5 Paramiko for Deployment

**Decision:** Use Python Paramiko (SFTP) for file transfer and SSH for server commands.

**Rationale:**
- The server runs SSH on port 23 (non-standard but functional)
- Paramiko handles the non-standard port and password authentication
- SFTP provides reliable file transfer (vs. SCP which was less reliable in testing)
- Single Python script handles kill old server, upload files, start new server

---

## 3. Role-Based Access Filtering

### Design

Three roles reflect common AD permission levels:

```
User (4 use cases)
  +-- Read-only: search, view groups, check rights, reports

Container Admin (12 use cases)  
  +-- User use cases + create users, manage groups, reset passwords, bulk import
  +-- Scoped to delegated OU/container

Domain Admin (15 use cases)
  +-- Container Admin use cases + create groups, move users between OUs
  +-- Full domain-wide operations
```

### Implementation

- Role filtering is client-side only — it controls UI visibility, not actual AD permissions
- Each use case declares its allowed roles in the config array
- The main page filters `useCases` based on `activeRole` state
- Switching roles resets the category filter and expanded card state
- Default role: `Container Admin` (most common operational role)

### Security Note

This is not an authorization system. The role selector is a convenience feature to hide irrelevant use cases. Actual AD permission enforcement happens on the domain controller when the generated command is executed.

---

## 4. Multi-Domain Support

### Design

In multi-domain AD forests, administrators often need to run the same operation across multiple domains. The multi-domain feature addresses this by:

1. Maintaining a list of domain configurations (FQDN + DC hostname)
2. Duplicating generated commands for each domain
3. Inserting `-Server "<dc_hostname>"` into AD cmdlet calls

### Implementation

- `DomainConfigPanel` component in the header manages the domain list
- State is stored in the main `Home` component and passed down to every use case via props
- `CommandForm.handleGenerate` checks if domains are configured:
  - No domains configured: output command as-is
  - Domains configured: for each domain, clone the command block and insert `-Server` parameter

### -Server Insertion Algorithm

```
Known AD cmdlets: Add-ADGroupMember, Remove-ADGroupMember, Get-ADGroupMember,
  Get-ADPrincipalGroupMembership, New-ADUser, Enable-ADAccount, Disable-ADAccount,
  Set-ADAccountPassword, Set-ADUser, Unlock-ADAccount, Get-ADUser, Get-ADGroup,
  New-ADGroup, Move-ADObject, Get-Acl, Import-Csv

For each line in the generated command:
  If the trimmed line starts with a known AD cmdlet followed by a space:
    Replace "CmdletName " with "CmdletName -Server \"dc01.domain.com\" "
  Otherwise:
    Leave the line unchanged (comments, variable assignments, pipes)
```

This string-based approach works because:
- Generated commands have predictable format (one cmdlet call per line)
- The `-Server` parameter is universally supported by all AD cmdlets
- Comments and variable assignments are left untouched

### Limitations

- Does not handle pipelined cmdlets that span multiple lines
- The domain list is session-only (not persisted across browser sessions)
- No validation that the DC hostname is reachable

---

## 5. Use Case Design Patterns

### Pattern 1: Single Input (e.g., Unlock Account)

Simplest pattern: one or two fields, direct command generation.

```
Input -> generate() -> single command string
```

### Pattern 2: Multi-Input with Conditional Parameters (e.g., Create User)

Multiple fields with optional parameters that are conditionally included in the command.

```
Inputs -> generate() -> collect non-empty fields -> build parameter list -> command
```

### Pattern 3: Mode-Based (e.g., Search Users, Check Effective Rights)

Multiple sub-modes with different form fields per mode, sharing a generate function with mode branching.

```
Mode selector -> show/hide form sections -> generate() -> mode-specific command
```

### Pattern 4: Batch Operations (e.g., Bulk Import, Multi-Domain)

Generate multi-line scripts with variables, loops, and optional error handling.

```
Inputs -> generate() -> multi-line script with PowerShell variables and ForEach-Object loops
```

---

## 6. Deployment Pipeline

```
Local Development                Remote Server (158.46.44.74)
-----------------                -----------------------------
src/app/page.tsx
  | next build (static export)
out/
  | paramiko SFTP upload
/home/userv/ad-gen/               <- 44 files, ~1.3 MB
  | python3 -m http.server 8080
http://158.46.44.74:8080         <- serves static files
```

### Build Optimization

- `output: "export"` skips all server-side rendering
- `reactStrictMode: false` avoids double-render in development
- `ignoreBuildErrors: true` skips TypeScript validation (static export does not benefit from it)
- Tree-shaking removes unused shadcn/ui components (only ~15 of 60+ are imported)

---

## 7. Future Considerations

### Persistence (localStorage)

Currently all form state is session-only. Adding localStorage persistence would allow saving domain configurations across sessions, remembering the last selected role, and preserving form field values for repeated operations.

### Authentication

If deployed in a more exposed environment, adding basic auth via the HTTP server or a reverse proxy would be straightforward. Not needed for current internal tool usage.

### Error Checking

Generated commands could be validated for correct DN format, reserved characters in usernames, and known cmdlet parameter combinations.

### Export All Commands

A "Generate all" button that produces commands for every use case with pre-filled values would be useful for documentation or runbook generation.

---

## 8. Glossary

| Term | Meaning |
|------|---------|
| OU | Organizational Unit - container in AD for organizing objects |
| DN | Distinguished Name - unique path to an AD object |
| DC | Domain Controller - server running AD services |
| sAMAccountName | Pre-Windows 2000 logon name (e.g., jdoe) |
| UPN | User Principal Name (e.g., jdoe@domain.com) |
| ACL | Access Control List - permissions on an AD object |
| RSAT | Remote Server Administration Tools |

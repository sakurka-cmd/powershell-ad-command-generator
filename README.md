# PowerShell AD Command Generator

Web-based tool for generating ready-to-use PowerShell commands for Active Directory management. Fill in the form, click Generate, copy the command, paste into PowerShell. No server-side processing — everything runs client-side.

**Live demo:** http://158.46.44.74:8080

---

## Features

### Use Cases (15 total)

| Category | Use Case | Roles |
|----------|----------|-------|
| **Groups** | Add users to group | Container Admin, Domain Admin |
| **Groups** | Remove users from group | Container Admin, Domain Admin |
| **Groups** | View group members | All roles |
| **Groups** | User's groups | All roles |
| **Users** | Create new user | Container Admin, Domain Admin |
| **Users** | Create new group | Domain Admin |
| **Users** | Move user to OU | Domain Admin |
| **Accounts** | Enable / Disable account | Container Admin, Domain Admin |
| **Accounts** | Reset password | Container Admin, Domain Admin |
| **Accounts** | Unlock account | Container Admin, Domain Admin |
| **Search** | Search / Lookup users | All roles |
| **Search** | OU users & groups report | All roles |
| **Search** | Check effective rights | All roles |
| **Import** | Bulk import from CSV | Container Admin, Domain Admin |

### Role-Based Access Filtering

Three permission levels control which use cases are visible:

| Role | Access Level | Description |
|------|-------------|-------------|
| **User** | Read-only | Search, view group members, check rights, view reports |
| **Container Admin** | OU-scoped management | All User-role use cases + create users, manage groups, reset passwords within delegated OU |
| **Domain Admin** | Full domain control | All use cases available, including domain-wide operations like creating groups, moving users between OUs |

Default role: **Container Admin**.

### Multi-Domain Support

Configure target domain controllers to generate commands with the `-Server` parameter:

1. Click "configure" next to "Target domain(s)" in the header
2. Add domain FQDN and DC hostname pairs (e.g., `corp.local` / `dc01.corp.local`)
3. All generated commands will automatically include `-Server "dc01.corp.local"` targeting each configured domain

When multiple domains are configured, the generator produces separate command blocks for each domain with clear headers.

### Search / Lookup Users (Advanced)

Two search modes with extensive customization:

- **Filter search**: 13 filter fields, 4 operators (like, eq, ne, notlike), enabled/disabled filter, custom sorting
- **By identity**: Lookup one or more users by sAMAccountName, UPN, SID, or DN — single user outputs Format-List, multiple users output Format-Table

5 property presets:
- Basic, Extended (20 properties), Account, Organization, Contact

### Check Effective Rights

Three sub-modes:
1. **View object ACL** — full access control list on any AD object with per-trustee summary
2. **User rights on object** — filter ACL entries for a specific principal (toggle inherited rights)
3. **Privileged group check** — audit membership against 11 default privileged groups (Domain Admins, Enterprise Admins, Schema Admins, Administrators, Account Operators, Server Operators, Backup Operators, Print Operators, DNSAdmins, Group Policy Creator Owners, Restricted Groups) with custom group list support

### OU Users & Groups Report

Enumerate all users in a specified OU and output a table containing:
- SamAccountName, Name, Enabled, Department, Title
- Group count and comma-separated group list
- Optional recursive search through sub-OUs
- Top-10 users by group count summary
- Optional CSV export command (commented, ready to uncomment)

---

## Architecture

### Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | Next.js 16 (React 19) | Static export support, modern React |
| Styling | Tailwind CSS 4 + shadcn/ui | Dark theme, PowerShell-inspired colors |
| Icons | Lucide React | Consistent icon set |
| Notifications | Sonner | Toast notifications for clipboard |
| Deployment | Python `http.server` | Zero-dependency production server |
| Transfer | Paramiko (SFTP) | SSH-based file upload |

### Static Export Strategy

The application uses Next.js `output: "export"` to generate a fully static site:

- Build output: `out/` directory (~1.3 MB, ~44 files)
- No Node.js runtime required on production server
- Served by Python's built-in HTTP server (`python3 -m http.server 8080`)
- All logic runs client-side — no API routes, no server processing
- Commands are generated in the browser and copied to clipboard

### Single-File Architecture

All use cases and UI live in `src/app/page.tsx` (~1400 lines):

- **Component functions** — each use case has its own React component with local state
- **CommandForm** — reusable wrapper with generate button, output display, and copy-to-clipboard
- **Field** — reusable labeled input/textarea component
- **UseCase config array** — declarative registration of all use cases with id, title, description, icon, category, roles, and component reference

This approach was chosen for:
- Minimal bundle size (only used components are tree-shaken)
- Zero routing overhead (single page)
- Easy to maintain and extend (add a component + config entry)
- Fast static generation (no dynamic pages)

### Role-Based Access Control (RBAC)

Role filtering is purely client-side — it determines which use cases are displayed, not actual AD permissions. The mapping:

- **User (4 use cases)**: view-members, get-user-groups, search-users, ou-users-groups, check-effective-rights
- **Container Admin (12 use cases)**: all User use cases + add/remove users, create user, enable/disable, reset password, unlock, bulk import
- **Domain Admin (15 use cases)**: all Container Admin use cases + create group, move user

### Multi-Domain Architecture

The domain configuration panel in the header manages a list of `{ name, dc }` objects. This list is passed to every `CommandForm` via props. When generating commands:

1. If no domains configured → generate command as-is (targets current domain)
2. If domains configured → for each domain, duplicate the command block with `-Server "<dc>"` inserted into every AD cmdlet line

The `-Server` insertion uses string matching against a known list of AD cmdlets (Add-ADGroupMember, Get-ADUser, etc.) and inserts the parameter immediately after the cmdlet name.

---

## Project Structure

```
src/
  app/
    page.tsx          # Main application (all use cases + UI)
    layout.tsx        # HTML metadata
    globals.css       # Tailwind CSS with dark theme
  components/
    ui/               # shadcn/ui components (button, card, input, etc.)
  hooks/
    use-mobile.ts     # Mobile breakpoint hook
  lib/
    utils.ts          # cn() utility for Tailwind class merging
out/                  # Static build output (deployed to server)
deploy_final.py       # Paramiko deployment script
```

---

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build static export
npm run build

# The static output is in out/
```

### Adding a New Use Case

1. Create a component function in `page.tsx`:
   ```tsx
   function MyNewUseCase({ domains }: { domains?: { name: string; dc: string }[] }) {
     const [myField, setMyField] = useState('')
     const generate = () => {
       if (!myField) return ''
       return `# My command\nGet-ADUser -Identity "${myField}"`
     }
     return <CommandForm domains={domains} inputs={
       <Field label="My field" value={myField} onChange={setMyField} placeholder="value" />
     } generate={generate} />
   }
   ```

2. Register it in the `useCases` config array:
   ```tsx
   {
     id: 'my-use-case',
     title: 'My New Use Case',
     description: 'What it does',
     icon: <SomeIcon className="h-4 w-4" />,
     category: 'search',  // group | user | account | search | import
     roles: ['container_admin', 'domain_admin'],
     component: MyNewUseCase,
   }
   ```

3. Rebuild and deploy

### Deployment

The deployment uses Paramiko (Python SSH/SFTP library):

```bash
python3 deploy_final.py
```

Steps:
1. SSH to remote server, kill existing http.server process
2. SFTP upload of `out/` directory to `/home/userv/ad-gen/`
3. Start Python HTTP server on port 8080

---

## Requirements for Using Generated Commands

- **Active Directory module for Windows PowerShell**: `Import-Module ActiveDirectory`
- **Windows Server 2008 R2+** or **Windows 7+** with RSAT installed
- Appropriate **AD permissions** matching the selected role
- PowerShell 5.1+ recommended

---

## License

Internal tool. Not intended for public distribution.

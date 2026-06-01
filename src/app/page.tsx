'use client'

import { useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Users,
  UserPlus,
  UserMinus,
  UserCog,
  Lock,
  Unlock,
  Search,
  FolderTree,
  FileUp,
  Terminal,
  Copy,
  Check,
  Shield,
  KeyRound,
  ArrowRightLeft,
  Crown,
  Building2,
  UserCircle,
  ShieldCheck,
  LayoutList,
  Server,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────

type Role = 'user' | 'container_admin' | 'domain_admin'

interface UseCase {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: 'group' | 'user' | 'account' | 'search' | 'import'
  roles: Role[]
  component: React.ComponentType<{ domains?: { name: string; dc: string }[] }>
}

const ROLES: { id: Role; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'user',
    label: 'User',
    icon: <UserCircle className="h-4 w-4" />,
    description: 'Read-only access: search and view AD objects',
  },
  {
    id: 'container_admin',
    label: 'Container Admin',
    icon: <Building2 className="h-4 w-4" />,
    description: 'Manage objects within delegated OU/container',
  },
  {
    id: 'domain_admin',
    label: 'Domain Admin',
    icon: <Crown className="h-4 w-4" />,
    description: 'Full domain-wide control over all AD objects',
  },
]

// ─── UseCase Components ──────────────────────────────────

function AddUsersToGroup({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [groupName, setGroupName] = useState('')
  const [users, setUsers] = useState('')

  const generate = () => {
    const usersList = users
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    if (!groupName || usersList.length === 0) return ''
    const members = usersList.map((u) => `"${u}"`).join(', ')
    return `# Add users to AD group\nAdd-ADGroupMember -Identity "${groupName}" -Members ${members}`
  }

  return <CommandForm domains={domains} inputs={
    <>
      <Field label="Group name" value={groupName} onChange={setGroupName} placeholder="e.g. 'VPN-Users'" />
      <Field label="Users (one per line)" value={users} onChange={setUsers} placeholder={`user1\nuser2\nuser3`} multiline />
    </>
  } generate={generate} />
}

function RemoveUsersFromGroup({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [groupName, setGroupName] = useState('')
  const [users, setUsers] = useState('')

  const generate = () => {
    const usersList = users
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    if (!groupName || usersList.length === 0) return ''
    const members = usersList.map((u) => `"${u}"`).join(', ')
    return `# Remove users from AD group\nRemove-ADGroupMember -Identity "${groupName}" -Members ${members} -Confirm:$false`
  }

  return <CommandForm domains={domains} inputs={
    <>
      <Field label="Group name" value={groupName} onChange={setGroupName} placeholder="e.g. 'VPN-Users'" />
      <Field label="Users (one per line)" value={users} onChange={setUsers} placeholder={`user1\nuser2\nuser3`} multiline />
    </>
  } generate={generate} />
}

function ViewGroupMembers({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [groupName, setGroupName] = useState('')
  const [recursive, setRecursive] = useState(false)
  const [properties, setProperties] = useState('Name,SamAccountName,DistinguishedName')

  const generate = () => {
    if (!groupName) return ''
    const props = properties || 'Name,SamAccountName'
    const recursiveFlag = recursive ? ' -Recursive' : ''
    return `# View group members\nGet-ADGroupMember -Identity "${groupName}"${recursiveFlag} | Select-Object ${props} | Format-Table -AutoSize`
  }

  return <CommandForm domains={domains} inputs={
    <>
      <Field label="Group name" value={groupName} onChange={setGroupName} placeholder="e.g. 'Domain Admins'" />
      <div className="flex items-center gap-2">
        <Checkbox id="recursive" checked={recursive} onCheckedChange={(v) => setRecursive(v === true)} />
        <Label htmlFor="recursive" className="text-sm cursor-pointer">Recursive (include nested groups)</Label>
      </div>
      <Field label="Output properties" value={properties} onChange={setProperties} placeholder="Name,SamAccountName" />
    </>
  } generate={generate} />
}

function GetUserGroups({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [username, setUsername] = useState('')
  const [detailed, setDetailed] = useState(false)

  const generate = () => {
    if (!username) return ''
    if (detailed) {
      return `# Get all groups for user (detailed)\nGet-ADPrincipalGroupMembership -Identity "${username}" | Get-ADGroup | Select-Object Name, GroupScope, GroupCategory, DistinguishedName | Format-Table -AutoSize`
    }
    return `# Get all groups for user\nGet-ADPrincipalGroupMembership -Identity "${username}" | Select-Object Name | Format-Table -AutoSize`
  }

  return <CommandForm domains={domains} inputs={
    <>
      <Field label="Username (sAMAccountName)" value={username} onChange={setUsername} placeholder="e.g. 'jdoe'" />
      <div className="flex items-center gap-2">
        <Checkbox id="detailed" checked={detailed} onCheckedChange={(v) => setDetailed(v === true)} />
        <Label htmlFor="detailed" className="text-sm cursor-pointer">Detailed output (group scope, type, DN)</Label>
      </div>
    </>
  } generate={generate} />
}

function CreateNewUser({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [name, setName] = useState('')
  const [samAccount, setSamAccount] = useState('')
  const [givenName, setGivenName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [ouPath, setOuPath] = useState('')
  const [password, setPassword] = useState('')
  const [changePassword, setChangePassword] = useState(true)

  const generate = () => {
    if (!name || !samAccount) return ''
    let cmd = `$password = ConvertTo-SecureString -AsPlainText "${password || 'TempPass123!'}" -Force\n\nNew-ADUser `
    const params: string[] = []
    params.push(`-Name "${name}"`)
    params.push(`-SamAccountName "${samAccount}"`)
    if (givenName) params.push(`-GivenName "${givenName}"`)
    if (surname) params.push(`-Surname "${surname}"`)
    if (email) params.push(`-EmailAddress "${email}"`)
    if (ouPath) params.push(`-Path "${ouPath}"`)
    params.push(`-AccountPassword $password`)
    params.push(`-ChangePasswordAtLogon $${changePassword}`)
    params.push(`-Enabled $true`)
    cmd += params.join(` \\\n    `)
    return `# Create new AD user\n${cmd}`
  }

  return <CommandForm domains={domains} inputs={
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Full name (Name)" value={name} onChange={setName} placeholder="John Doe" />
      <Field label="sAMAccountName" value={samAccount} onChange={setSamAccount} placeholder="jdoe" />
      <Field label="First name" value={givenName} onChange={setGivenName} placeholder="John" />
      <Field label="Last name" value={surname} onChange={setSurname} placeholder="Doe" />
      <Field label="Email" value={email} onChange={setEmail} placeholder="jdoe@domain.com" />
      <Field label="OU Path" value={ouPath} onChange={setOuPath} placeholder='OU=Users,DC=domain,DC=com' />
      <Field label="Initial password" value={password} onChange={setPassword} placeholder="TempPass123!" />
      <div className="flex items-center gap-2">
        <Checkbox id="changePass" checked={changePassword} onCheckedChange={(v) => setChangePassword(v === true)} />
        <Label htmlFor="changePass" className="text-sm cursor-pointer">Require password change at first logon</Label>
      </div>
    </div>
  } generate={generate} />
}

function EnableDisableAccount({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [username, setUsername] = useState('')
  const [action, setAction] = useState<'enable' | 'disable'>('enable')

  const generate = () => {
    if (!username) return ''
    const cmd = action === 'enable' ? 'Enable-ADAccount' : 'Disable-ADAccount'
    return `# ${action === 'enable' ? 'Enable' : 'Disable'} AD account\n${cmd} -Identity "${username}"`
  }

  return <CommandForm domains={domains} inputs={
    <>
      <Field label="Username (sAMAccountName)" value={username} onChange={setUsername} placeholder="jdoe" />
      <div className="space-y-2">
        <Label className="text-sm font-medium">Action</Label>
        <Select value={action} onValueChange={(v) => setAction(v as 'enable' | 'disable')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="enable">Enable account</SelectItem>
            <SelectItem value="disable">Disable account</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  } generate={generate} />
}

function ResetPassword({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [requireChange, setRequireChange] = useState(true)

  const generate = () => {
    if (!username || !newPassword) return ''
    let cmd = `$newPassword = ConvertTo-SecureString -AsPlainText "${newPassword}" -Force\n\n`
    cmd += `Set-ADAccountPassword -Identity "${username}" -Reset -NewPassword $newPassword`
    if (requireChange) {
      cmd += `\nSet-ADUser -Identity "${username}" -ChangePasswordAtLogon $true`
    }
    return `# Reset user password\n${cmd}`
  }

  return <CommandForm domains={domains} inputs={
    <>
      <Field label="Username (sAMAccountName)" value={username} onChange={setUsername} placeholder="jdoe" />
      <Field label="New password" value={newPassword} onChange={setNewPassword} placeholder="NewSecurePass123!" />
      <div className="flex items-center gap-2">
        <Checkbox id="reqChange" checked={requireChange} onCheckedChange={(v) => setRequireChange(v === true)} />
        <Label htmlFor="reqChange" className="text-sm cursor-pointer">Require password change at next logon</Label>
      </div>
    </>
  } generate={generate} />
}

function UnlockAccount({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [username, setUsername] = useState('')

  const generate = () => {
    if (!username) return ''
    return `# Unlock AD account\nUnlock-ADAccount -Identity "${username}"`
  }

  return <CommandForm domains={domains} inputs={
    <Field label="Username (sAMAccountName)" value={username} onChange={setUsername} placeholder="jdoe" />
  } generate={generate} />
}

const SEARCH_FILTER_FIELDS = [
  { value: 'Name', label: 'Name (display name)' },
  { value: 'SamAccountName', label: 'sAMAccountName (login)' },
  { value: 'EmailAddress', label: 'EmailAddress' },
  { value: 'Title', label: 'Title (job title)' },
  { value: 'Department', label: 'Department' },
  { value: 'Description', label: 'Description' },
  { value: 'Office', label: 'Office' },
  { value: 'City', label: 'City' },
  { value: 'Company', label: 'Company' },
  { value: 'EmployeeNumber', label: 'EmployeeNumber' },
  { value: 'Surname', label: 'Surname (last name)' },
  { value: 'GivenName', label: 'GivenName (first name)' },
  { value: 'UserPrincipalName', label: 'UPN (user@domain)' },
] as const

const SEARCH_OPERATOR_OPTIONS = [
  { value: 'like', label: 'like (contains / wildcard)' },
  { value: 'eq', label: 'eq (exact match)' },
  { value: 'ne', label: 'ne (not equal)' },
  { value: '-notlike', label: 'notlike (does not contain)' },
] as const

const DEFAULT_EXTENDED_PROPS = [
  'Name', 'SamAccountName', 'UserPrincipalName',
  'GivenName', 'Surname', 'EmailAddress',
  'Title', 'Department', 'Company',
  'Office', 'City',
  'Enabled', 'LockedOut',
  'PasswordNeverExpires',
  'PasswordLastSet', 'LastLogonDate',
  'whenCreated', 'whenChanged',
  'Description',
  'DistinguishedName',
]

const PRESET_PROPS: Record<string, string> = {
  basic: 'Name,SamAccountName,EmailAddress,Enabled',
  extended: DEFAULT_EXTENDED_PROPS.join(','),
  account: 'Name,SamAccountName,Enabled,LockedOut,PasswordNeverExpires,PasswordLastSet,LastLogonDate,whenCreated',
  org: 'Name,SamAccountName,Title,Department,Company,Office,City,Manager,Description',
  contact: 'Name,SamAccountName,EmailAddress,UserPrincipalName,Office,PhoneNumber',
}

function SearchUsers({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [searchMode, setSearchMode] = useState<'filter' | 'identities'>('filter')
  // Filter mode state
  const [filterField, setFilterField] = useState('Name')
  const [filterOperator, setFilterOperator] = useState('like')
  const [filterValue, setFilterValue] = useState('')
  // Identity mode state
  const [identities, setIdentities] = useState('')
  // Common
  const [properties, setProperties] = useState(DEFAULT_EXTENDED_PROPS.join(','))
  const [propPreset, setPropPreset] = useState('extended')
  const [sortProperty, setSortProperty] = useState('Name')
  const [enabledOnly, setEnabledOnly] = useState(false)
  const [disabledOnly, setDisabledOnly] = useState(false)

  const handlePreset = (preset: string) => {
    setPropPreset(preset)
    if (PRESET_PROPS[preset]) {
      setProperties(PRESET_PROPS[preset])
    }
  }

  const generate = () => {
    const props = properties || DEFAULT_EXTENDED_PROPS.join(',')
    const lines: string[] = []

    if (searchMode === 'filter') {
      if (!filterValue) return ''
      lines.push('# Search users in AD')
      const filterExpr = filterOperator === 'like'
        ? `"${filterValue}*"`
        : `"${filterValue}"`

      let enabledFilter = ''
      if (enabledOnly) enabledFilter = ' -and $true -eq $_.Enabled'
      if (disabledOnly) enabledFilter = ' -and $false -eq $_.Enabled'

      if (enabledOnly || disabledOnly) {
        lines.push(`Get-ADUser -Filter {${filterField} -${filterOperator} ${filterExpr}${enabledFilter}} -Properties ${props} |`
          + `\n    Select-Object ${props} |`
          + `\n    Sort-Object ${sortProperty} |`
          + `\n    Format-Table -AutoSize -Wrap`)
      } else {
        lines.push(`Get-ADUser -Filter {${filterField} -${filterOperator} ${filterExpr}} -Properties ${props} |`
          + `\n    Select-Object ${props} |`
          + `\n    Sort-Object ${sortProperty} |`
          + `\n    Format-Table -AutoSize -Wrap`)
      }
    } else {
      const idList = identities
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (idList.length === 0) return ''

      if (idList.length === 1) {
        lines.push('# Get user information')
        lines.push(`Get-ADUser -Identity "${idList[0]}" -Properties ${props} |`
          + `\n    Select-Object ${props} |`
          + `\n    Format-List`) // single user -> Format-List
      } else {
        const quoted = idList.map((id) => `"${id}"`).join(', ')
        lines.push('# Get information for multiple users')
        lines.push(`$users = @(${quoted})`)
        lines.push(`$users | ForEach-Object { Get-ADUser -Identity $_ -Properties ${props} } |`
          + `\n    Select-Object ${props} |`
          + `\n    Sort-Object ${sortProperty} |`
          + `\n    Format-Table -AutoSize -Wrap`)
      }
    }
    return lines.join('\n')
  }

  return <CommandForm domains={domains} inputs={
    <div className="space-y-4">
      {/* Search mode tabs */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Search mode</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSearchMode('filter')}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              searchMode === 'filter'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
          >
            Filter search
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('identities')}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              searchMode === 'identities'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
          >
            By identity (multiple)
          </button>
        </div>
      </div>

      {/* Filter mode inputs */}
      {searchMode === 'filter' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Filter field</Label>
            <Select value={filterField} onValueChange={setFilterField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEARCH_FILTER_FIELDS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Operator</Label>
            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEARCH_OPERATOR_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Search value" value={filterValue} onChange={setFilterValue} placeholder="e.g. 'ivan'" />
        </div>
      )}

      {/* Identity mode inputs */}
      {searchMode === 'identities' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Usernames or DNs (one per line)</Label>
          <Textarea
            value={identities}
            onChange={(e) => setIdentities(e.target.value)}
            placeholder={`jdoe\nasmith\nCN=John Doe,OU=Users,DC=domain,DC=com`}
            rows={5}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Supports sAMAccountName, userPrincipalName, SID, or DistinguishedName. One user = Format-List, multiple = Format-Table.
          </p>
        </div>
      )}

      {/* Account status filter (only in filter mode) */}
      {searchMode === 'filter' && (
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox id="enabledOnly" checked={enabledOnly} onCheckedChange={(v) => { setEnabledOnly(v === true); if (v === true) setDisabledOnly(false) }} />
            <Label htmlFor="enabledOnly" className="text-sm cursor-pointer">Enabled only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="disabledOnly" checked={disabledOnly} onCheckedChange={(v) => { setDisabledOnly(v === true); if (v === true) setEnabledOnly(false) }} />
            <Label htmlFor="disabledOnly" className="text-sm cursor-pointer">Disabled only</Label>
          </div>
        </div>
      )}

      {/* Sort + Properties presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sort by</Label>
          <Select value={sortProperty} onValueChange={setSortProperty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEFAULT_EXTENDED_PROPS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Properties preset</Label>
          <Select value={propPreset} onValueChange={handlePreset}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic (name, login, email, status)</SelectItem>
              <SelectItem value="extended">Extended (full info)</SelectItem>
              <SelectItem value="account">Account (password, lockout, dates)</SelectItem>
              <SelectItem value="org">Organization (dept, company, office)</SelectItem>
              <SelectItem value="contact">Contact (email, UPN, phone)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Custom properties */}
      <Field label="Output properties (comma-separated, edit freely)" value={properties} onChange={setProperties} placeholder="Name,SamAccountName,EmailAddress" multiline />
    </div>
  } generate={generate} />
}

function OUUserGroupReport({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [ouPath, setOuPath] = useState('')
  const [includeNestedOUs, setIncludeNestedOUs] = useState(false)

  const generate = () => {
    if (!ouPath) return ''
    const lines: string[] = []
    lines.push('# Report: Users and their group memberships in OU')
    lines.push(`$ouPath = "${ouPath}"`)
    lines.push('')

    if (includeNestedOUs) {
      lines.push('# Get all users from this OU and all sub-OUs')
      lines.push('$users = Get-ADUser -Filter * -SearchBase $ouPath -SearchScope Subtree -Properties MemberOf,Department,Title')
    } else {
      lines.push('# Get users only from the specified OU (not sub-OUs)')
      lines.push('$users = Get-ADUser -Filter * -SearchBase $ouPath -SearchScope OneLevel -Properties MemberOf,Department,Title')
    }
    lines.push('')
    lines.push('# Build custom object: user info + comma-separated group list')
    lines.push('$report = $users | ForEach-Object {')
    lines.push('    $groups = $_.MemberOf | ForEach-Object {')
    lines.push('        ($_.Split(",")[0]).Replace("CN=","")')
    lines.push('    }')
    lines.push('    [PSCustomObject]@{')
    lines.push('        SamAccountName = $_.SamAccountName')
    lines.push('        Name          = $_.Name')
    lines.push('        Enabled       = $_.Enabled')
    lines.push('        Department    = $_.Department')
    lines.push('        Title         = $_.Title')
    lines.push('        GroupCount    = ($groups | Measure-Object).Count')
    lines.push('        Groups        = ($groups | Sort-Object) -join ", "')
    lines.push('    }')
    lines.push('}')
    lines.push('')
    lines.push('# Output table')
    lines.push('$report | Select-Object SamAccountName, Name, Enabled, Department, Title, GroupCount, Groups |')
    lines.push('    Sort-Object Name |')
    lines.push('    Format-Table -AutoSize -Wrap')
    lines.push('')
    lines.push('# Export to CSV (optional - uncomment to save)')
    lines.push('# $report | Sort-Object Name | Export-Csv -Path "C:\\OU-User-Groups-Report.csv" -NoTypeInformation -Encoding UTF8')
    lines.push('')
    lines.push(`# Total users: $($report.Count)`)
    lines.push('# Users with most groups:')
    lines.push('$report | Sort-Object GroupCount -Descending | Select-Object -First 10 SamAccountName, GroupCount, Groups | Format-Table -AutoSize -Wrap')
    return lines.join('\n')
  }

  return <CommandForm domains={domains} inputs={
    <div className="space-y-4">
      <Field label="OU Path (Distinguished Name)" value={ouPath} onChange={setOuPath} placeholder="OU=Users,DC=domain,DC=com" />
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="nestedOUs" checked={includeNestedOUs} onCheckedChange={(v) => setIncludeNestedOUs(v === true)} />
          <Label htmlFor="nestedOUs" className="text-sm cursor-pointer">Include sub-OUs (recursive)</Label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Generates a PowerShell script that enumerates all users in the specified OU and outputs a table
        with their properties, group count, and comma-separated group memberships. Includes a top-10 by group
        count summary and an optional CSV export command.
      </p>
    </div>
  } generate={generate} />
}

function CheckEffectiveRights({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [checkMode, setCheckMode] = useState<'acl' | 'user-rights' | 'privileged-groups'>('acl')
  // ACL mode
  const [targetObject, setTargetObject] = useState('')
  // User rights mode
  const [principal, setPrincipal] = useState('')
  const [rightsObject, setRightsObject] = useState('')
  const [showInherited, setShowInherited] = useState(true)
  // Privileged groups mode
  const [targetUser, setTargetUser] = useState('')
  const [customGroups, setCustomGroups] = useState('')

  const PRIVILEGED_GROUPS = [
    'Domain Admins', 'Enterprise Admins', 'Schema Admins',
    'Administrators', 'Account Operators', 'Server Operators',
    'Backup Operators', 'Print Operators', 'DNSAdmins',
    'Group Policy Creator Owners', 'Restricted Groups',
  ]

  const generate = () => {
    const lines: string[] = []

    if (checkMode === 'acl') {
      if (!targetObject) return ''
      lines.push('# View ACL (access control list) on an AD object')
      lines.push(`$acl = Get-Acl "AD:\\${targetObject}"`)
      lines.push(`$acl.Access | Select-Object IdentityReference, ActiveDirectoryRights, AccessControlType, IsInherited, ObjectType, InheritanceType |`
        + `\n    Sort-Object IdentityReference |`
        + `\n    Format-Table -AutoSize -Wrap`)
      lines.push('')
      lines.push('# Summary: permission count per trustee')
      lines.push(`$acl.Access | Group-Object IdentityReference |`
        + `\n    Select-Object Count, Name |`
        + `\n    Sort-Object Count -Descending |`
        + `\n    Format-Table -AutoSize`)
    }

    else if (checkMode === 'user-rights') {
      if (!principal || !rightsObject) return ''
      lines.push('# Check effective rights of a user/principal on a specific AD object')
      lines.push(`$objectDN = "${rightsObject}"`)
      lines.push(`$principalName = "${principal}"`)
      lines.push('')
      lines.push('# Get all access rules on the object')
      lines.push(`$acl = Get-Acl "AD:\\$objectDN"`)
      lines.push(`$rules = $acl.Access`)
      lines.push('')
      if (showInherited) {
        lines.push('# Show direct and inherited rights')
      } else {
        lines.push('# Show only directly assigned rights (excluding inherited)')
      }
      lines.push(`$filtered = $rules | Where-Object { $_.IdentityReference -match $principalName${showInherited ? '' : ' -and $_.IsInherited -eq $false'} }`)
      lines.push('')
      lines.push('if ($filtered) {')
      lines.push('    $filtered | Select-Object IdentityReference, ActiveDirectoryRights, AccessControlType, IsInherited, ObjectType, InheritanceType |')
      lines.push('        Sort-Object ActiveDirectoryRights |')
      lines.push('        Format-Table -AutoSize -Wrap')
      lines.push('} else {')
      lines.push('    Write-Host "No access rules found for $principalName on $objectDN" -ForegroundColor Yellow')
      lines.push('}')
    }

    else if (checkMode === 'privileged-groups') {
      if (!targetUser) return ''
      const groups = customGroups.trim()
        ? customGroups.split(',').map((g) => g.trim()).filter(Boolean)
        : PRIVILEGED_GROUPS

      lines.push('# Check if user is a member of privileged groups')
      lines.push(`$user = Get-ADUser -Identity "${targetUser}" -Properties MemberOf`)
      lines.push('$userGroups = $user.MemberOf | ForEach-Object {')
      lines.push('    ($_.Split(",")[0]).Replace("CN=","")')
      lines.push('}')
      lines.push('')
      lines.push('$privilegedGroups = @(')
      groups.forEach((g) => {
        lines.push(`    "${g}"${g === groups[groups.length - 1] ? '' : ','}`)
      })
      lines.push(')')
      lines.push('')
      lines.push('$matched = $userGroups | Where-Object { $privilegedGroups -contains $_ }')
      lines.push('')
      lines.push('if ($matched) {')
      lines.push('    Write-Host "User is a member of $($matched.Count) privileged group(s):" -ForegroundColor Yellow')
      lines.push('    $matched | ForEach-Object { Write-Host "  - $_" }')
      lines.push('} else {')
      lines.push('    Write-Host "User is NOT a member of any monitored privileged groups." -ForegroundColor Green')
      lines.push('}')
      lines.push('')
      lines.push('# Also show ALL group memberships for full picture')
      lines.push('$user.MemberOf | Get-ADGroup | Select-Object Name, GroupScope, GroupCategory | Sort-Object Name | Format-Table -AutoSize')
    }

    return lines.join('\n')
  }

  return <CommandForm domains={domains} inputs={
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Check mode</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {([
            { value: 'acl', label: 'View object ACL' },
            { value: 'user-rights', label: 'User rights on object' },
            { value: 'privileged-groups', label: 'Privileged group check' },
          ] as const).map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setCheckMode(mode.value)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                checkMode === mode.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* ACL mode */}
      {checkMode === 'acl' && (
        <Field label="AD object (Distinguished Name)" value={targetObject} onChange={setTargetObject} placeholder="OU=Users,DC=domain,DC=com" />
      )}

      {/* User rights mode */}
      {checkMode === 'user-rights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Principal (user/group)" value={principal} onChange={setPrincipal} placeholder="DOMAIN\\jdoe or jdoe" />
          <Field label="AD object (Distinguished Name)" value={rightsObject} onChange={setRightsObject} placeholder="OU=Users,DC=domain,DC=com" />
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox id="showInherited" checked={showInherited} onCheckedChange={(v) => setShowInherited(v === true)} />
            <Label htmlFor="showInherited" className="text-sm cursor-pointer">Include inherited permissions</Label>
          </div>
        </div>
      )}

      {/* Privileged groups mode */}
      {checkMode === 'privileged-groups' && (
        <div className="space-y-4">
          <Field label="Username (sAMAccountName)" value={targetUser} onChange={setTargetUser} placeholder="jdoe" />
          <Field
            label="Privileged groups list (comma-separated, leave empty for default)"
            value={customGroups}
            onChange={setCustomGroups}
            placeholder={PRIVILEGED_GROUPS.join(', ')}
          />
          <p className="text-xs text-muted-foreground">
            Default list: {PRIVILEGED_GROUPS.join(', ')}. Edit the field above to use a custom list.
          </p>
        </div>
      )}
    </div>
  } generate={generate} />
}

function CreateGroup({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [groupName, setGroupName] = useState('')
  const [scope, setScope] = useState('Global')
  const [category, setCategory] = useState('Security')
  const [description, setDescription] = useState('')
  const [ouPath, setOuPath] = useState('')

  const generate = () => {
    if (!groupName) return ''
    let cmd = 'New-ADGroup '
    const params: string[] = []
    params.push(`-Name "${groupName}"`)
    params.push(`-GroupScope ${scope}`)
    params.push(`-GroupCategory ${category}`)
    if (description) params.push(`-Description "${description}"`)
    if (ouPath) params.push(`-Path "${ouPath}"`)
    cmd += params.join(' \\\n    ')
    return `# Create new AD group\n${cmd}`
  }

  return <CommandForm domains={domains} inputs={
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Group name" value={groupName} onChange={setGroupName} placeholder="e.g. 'Project-Alpha'" />
      <div className="space-y-2">
        <Label className="text-sm font-medium">Group scope</Label>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Global">Global</SelectItem>
            <SelectItem value="DomainLocal">DomainLocal</SelectItem>
            <SelectItem value="Universal">Universal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Group category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Security">Security</SelectItem>
            <SelectItem value="Distribution">Distribution</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field label="Description" value={description} onChange={setDescription} placeholder="Group description" />
      <Field label="OU Path" value={ouPath} onChange={setOuPath} placeholder='OU=Groups,DC=domain,DC=com' />
    </div>
  } generate={generate} />
}

function MoveUser({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [username, setUsername] = useState('')
  const [targetOU, setTargetOU] = useState('')

  const generate = () => {
    if (!username || !targetOU) return ''
    return `# Move user to another OU\nMove-ADObject -Identity (Get-ADUser -Identity "${username}").DistinguishedName -TargetPath "${targetOU}"`
  }

  return <CommandForm domains={domains} inputs={
    <>
      <Field label="Username (sAMAccountName)" value={username} onChange={setUsername} placeholder="jdoe" />
      <Field label="Target OU (Distinguished Name)" value={targetOU} onChange={setTargetOU} placeholder='OU=Managers,DC=domain,DC=com' />
    </>
  } generate={generate} />
}

function BulkImportCSV({ domains }: { domains?: { name: string; dc: string }[] }) {
  const [csvHeaders, setCsvHeaders] = useState('Name,SamAccountName,GivenName,Surname,EmailAddress,Department')
  const [ouPath, setOuPath] = useState('')
  const [password, setPassword] = useState('TempPass123!')
  const [changePwd, setChangePwd] = useState(true)

  const generate = () => {
    if (!csvHeaders) return ''
    const headers = csvHeaders.split(',').map((h) => h.trim()).filter(Boolean)
    const propMap = headers.map((h) => `${h} $_.${h}`).join(' \\\n    ')

    let script = `# Bulk import users from CSV\n`
    script += `$csvPath = "C:\\\\Users.csv"\n`
    script += `$password = ConvertTo-SecureString -AsPlainText "${password}" -Force\n\n`
    script += `Import-Csv $csvPath | ForEach-Object {\n`
    script += `    New-ADUser \\\n`
    script += `        -Name $_.Name \\\n`
    script += `        -SamAccountName $_.SamAccountName \\\n`
    if (headers.includes('GivenName')) script += `        -GivenName $_.GivenName \\\n`
    if (headers.includes('Surname')) script += `        -Surname $_.Surname \\\n`
    if (headers.includes('EmailAddress')) script += `        -EmailAddress $_.EmailAddress \\\n`
    if (headers.includes('Department')) script += `        -Department $_.Department \\\n`
    if (headers.includes('Title')) script += `        -Title $_.Title \\\n`
    if (headers.includes('Description')) script += `        -Description $_.Description \\\n`
    if (ouPath) script += `        -Path "${ouPath}" \\\n`
    script += `        -AccountPassword $password \\\n`
    script += `        -ChangePasswordAtLogon $${changePwd} \\\n`
    script += `        -Enabled $true\n`
    script += `}`

    return script
  }

  return <CommandForm domains={domains} inputs={
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium">CSV column headers (comma-separated)</Label>
        <Input
          value={csvHeaders}
          onChange={(e) => setCsvHeaders(e.target.value)}
          placeholder="Name,SamAccountName,GivenName,Surname"
        />
        <p className="text-xs text-muted-foreground">
          CSV file must have a header row matching these columns
        </p>
      </div>
      <Field label="Target OU Path" value={ouPath} onChange={setOuPath} placeholder='OU=NewUsers,DC=domain,DC=com' />
      <Field label="Default password for all users" value={password} onChange={setPassword} placeholder="TempPass123!" />
      <div className="flex items-center gap-2">
        <Checkbox id="changePwdBulk" checked={changePwd} onCheckedChange={(v) => setChangePwd(v === true)} />
        <Label htmlFor="changePwdBulk" className="text-sm cursor-pointer">Require password change at first logon</Label>
      </div>
    </>
  } generate={generate} />
}

// ─── Reusable Components ─────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="font-mono text-sm"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm"
        />
      )}
    </div>
  )
}

function CommandForm({
  inputs,
  generate,
  domains = [],
}: {
  inputs: React.ReactNode
  generate: () => string
  domains?: { name: string; dc: string }[]
}) {
  const [command, setCommand] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(() => {
    const baseCmd = generate()
    if (domains.length === 0 || !baseCmd) {
      setCommand(baseCmd)
      setCopied(false)
      return
    }
    // For multi-domain: generate a block per domain with -Server inserted
    const blocks: string[] = []
    for (const domain of domains) {
      const header = `# --- Domain: ${domain.name} (${domain.dc}) ---`
      const adCmdlets = ['Add-ADGroupMember', 'Remove-ADGroupMember', 'Get-ADGroupMember',
        'Get-ADPrincipalGroupMembership', 'New-ADUser', 'Enable-ADAccount', 'Disable-ADAccount',
        'Set-ADAccountPassword', 'Set-ADUser', 'Unlock-ADAccount', 'Get-ADUser', 'Get-ADGroup',
        'New-ADGroup', 'Move-ADObject', 'Get-Acl', 'Import-Csv']
      const lines = baseCmd.split('\n')
      const modified = lines.map((line) => {
        const trimmed = line.trimStart()
        for (const cmdlet of adCmdlets) {
          if (trimmed.startsWith(cmdlet + ' ') || trimmed.startsWith(cmdlet + '\\')) {
            return line.replace(cmdlet, `${cmdlet} -Server "${domain.dc}"`)
          }
        }
        return line
      })
      blocks.push(header)
      blocks.push(modified.join('\n'))
    }
    setCommand(blocks.join('\n\n'))
    setCopied(false)
  }, [generate, domains])

  const handleCopy = useCallback(async () => {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      toast.success('Command copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = command
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      toast.success('Command copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    }
  }, [command])

  return (
    <div className="space-y-4">
      <div className="space-y-4">{inputs}</div>
      <Button onClick={handleGenerate} className="w-full sm:w-auto gap-2">
        <Terminal className="h-4 w-4" />
        Generate command
      </Button>

      {command && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Generated PowerShell command</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <pre className="bg-zinc-950 text-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed border border-zinc-800">
            <code>{command}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Use Cases Config ────────────────────────────────────

const useCases: UseCase[] = [
  {
    id: 'add-users',
    title: 'Add users to group',
    description: 'Add one or more users to an existing AD group',
    icon: <UserPlus className="h-4 w-4" />,
    category: 'group',
    roles: ['container_admin', 'domain_admin'],
    component: AddUsersToGroup,
  },
  {
    id: 'remove-users',
    title: 'Remove users from group',
    description: 'Remove one or more users from an AD group',
    icon: <UserMinus className="h-4 w-4" />,
    category: 'group',
    roles: ['container_admin', 'domain_admin'],
    component: RemoveUsersFromGroup,
  },
  {
    id: 'view-members',
    title: 'View group members',
    description: 'List all members of an AD group with optional details',
    icon: <Users className="h-4 w-4" />,
    category: 'group',
    roles: ['user', 'container_admin', 'domain_admin'],
    component: ViewGroupMembers,
  },
  {
    id: 'get-user-groups',
    title: "User's groups",
    description: 'View all groups that a specific user belongs to',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    category: 'group',
    roles: ['user', 'container_admin', 'domain_admin'],
    component: GetUserGroups,
  },
  {
    id: 'create-user',
    title: 'Create new user',
    description: 'Create a new Active Directory user account',
    icon: <UserCog className="h-4 w-4" />,
    category: 'user',
    roles: ['container_admin', 'domain_admin'],
    component: CreateNewUser,
  },
  {
    id: 'enable-disable',
    title: 'Enable / Disable account',
    description: 'Activate or deactivate an AD user account',
    icon: <Shield className="h-4 w-4" />,
    category: 'account',
    roles: ['container_admin', 'domain_admin'],
    component: EnableDisableAccount,
  },
  {
    id: 'reset-password',
    title: 'Reset password',
    description: 'Reset a user password and optionally require change at logon',
    icon: <KeyRound className="h-4 w-4" />,
    category: 'account',
    roles: ['container_admin', 'domain_admin'],
    component: ResetPassword,
  },
  {
    id: 'unlock-account',
    title: 'Unlock account',
    description: 'Unlock a locked-out Active Directory user account',
    icon: <Unlock className="h-4 w-4" />,
    category: 'account',
    roles: ['container_admin', 'domain_admin'],
    component: UnlockAccount,
  },
  {
    id: 'search-users',
    title: 'Search / Lookup users',
    description: 'Search by filter or lookup multiple users with extended properties and table output',
    icon: <Search className="h-4 w-4" />,
    category: 'search',
    roles: ['user', 'container_admin', 'domain_admin'],
    component: SearchUsers,
  },
  {
    id: 'ou-users-groups',
    title: 'OU users & groups report',
    description: 'List all users in an OU with their group memberships as a table',
    icon: <LayoutList className="h-4 w-4" />,
    category: 'search',
    roles: ['user', 'container_admin', 'domain_admin'],
    component: OUUserGroupReport,
  },
  {
    id: 'check-effective-rights',
    title: 'Check effective rights',
    description: 'View ACL on AD objects, check user permissions, or audit privileged group memberships',
    icon: <ShieldCheck className="h-4 w-4" />,
    category: 'search',
    roles: ['user', 'container_admin', 'domain_admin'],
    component: CheckEffectiveRights,
  },
  {
    id: 'create-group',
    title: 'Create new group',
    description: 'Create a new security or distribution group in AD',
    icon: <FolderTree className="h-4 w-4" />,
    category: 'user',
    roles: ['domain_admin'],
    component: CreateGroup,
  },
  {
    id: 'move-user',
    title: 'Move user to OU',
    description: 'Move a user to a different Organizational Unit',
    icon: <FolderTree className="h-4 w-4" />,
    category: 'user',
    roles: ['domain_admin'],
    component: MoveUser,
  },
  {
    id: 'bulk-import',
    title: 'Bulk import from CSV',
    description: 'Import multiple users from a CSV file into Active Directory',
    icon: <FileUp className="h-4 w-4" />,
    category: 'import',
    roles: ['container_admin', 'domain_admin'],
    component: BulkImportCSV,
  },
]

const categories = [
  { id: 'all', label: 'All', icon: <Terminal className="h-4 w-4" /> },
  { id: 'group', label: 'Groups', icon: <Users className="h-4 w-4" /> },
  { id: 'user', label: 'Users', icon: <UserCog className="h-4 w-4" /> },
  { id: 'account', label: 'Accounts', icon: <Shield className="h-4 w-4" /> },
  { id: 'search', label: 'Search', icon: <Search className="h-4 w-4" /> },
  { id: 'import', label: 'Import', icon: <FileUp className="h-4 w-4" /> },
]

// ─── Domain Configuration ─────────────────────────────────

function DomainConfigPanel({
  domains,
  onDomainsChange,
}: {
  domains: { name: string; dc: string }[]
  onDomainsChange: (d: { name: string; dc: string }[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDc, setNewDc] = useState('')

  const addDomain = () => {
    if (!newName.trim() || !newDc.trim()) return
    if (domains.some((d) => d.name === newName.trim())) return
    onDomainsChange([...domains, { name: newName.trim(), dc: newDc.trim() }])
    setNewName('')
    setNewDc('')
  }

  const removeDomain = (idx: number) => {
    onDomainsChange(domains.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Target domain(s):</Label>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          {open ? 'hide' : 'configure'}
        </button>
      </div>
      {open && (
        <div className="rounded-lg border p-3 space-y-3 bg-card">
          <p className="text-xs text-muted-foreground">
            Add domain controllers to generate commands with -Server parameter targeting specific domains.
            Leave empty for the default (current) domain.
          </p>
          {domains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {domains.map((d, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 text-xs">
                  <Server className="h-3 w-3" />
                  {d.name} ({d.dc})
                  <button
                    type="button"
                    onClick={() => removeDomain(i)}
                    className="ml-0.5 text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    x
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Domain FQDN"
              className="text-xs h-8"
            />
            <div className="flex gap-1">
              <Input
                value={newDc}
                onChange={(e) => setNewDc(e.target.value)}
                placeholder="DC hostname"
                className="text-xs h-8"
              />
              <Button size="sm" variant="outline" onClick={addDomain} className="h-8 px-2 shrink-0">
                +
              </Button>
            </div>
          </div>
        </div>
      )}
      {!open && domains.length === 0 && (
        <p className="text-xs text-muted-foreground">Default domain (no -Server parameter)</p>
      )}
      {!open && domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {domains.map((d, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-[10px]">
              <Server className="h-3 w-3" />
              {d.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeRole, setActiveRole] = useState<Role>('container_admin')
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [domains, setDomains] = useState<{ name: string; dc: string }[]>([])

  const roleFiltered = useCases.filter((uc) => uc.roles.includes(activeRole))

  const filteredCases =
    activeCategory === 'all'
      ? roleFiltered
      : roleFiltered.filter((uc) => uc.category === activeCategory)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                PowerShell AD Command Generator
              </h1>
              <p className="text-sm text-muted-foreground">
                Generate ready-to-use PowerShell commands for Active Directory management
              </p>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="mt-4 space-y-2">
            <Label className="text-sm font-medium">Role: select your AD permissions level</Label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => {
                const isActive = activeRole === role.id
                const count = useCases.filter((uc) => uc.roles.includes(role.id)).length
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setActiveRole(role.id)
                      setActiveCategory('all')
                      setExpandedCard(null)
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background border-border hover:bg-accent'
                    }`}
                  >
                    {role.icon}
                    <span>{role.label}</span>
                    <Badge
                      variant={isActive ? 'secondary' : 'outline'}
                      className={`text-[10px] px-1.5 py-0 ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
                    >
                      {count}
                    </Badge>
                  </button>
                )
              })}
            </div>
            {ROLES.find((r) => r.id === activeRole) && (
              <p className="text-xs text-muted-foreground">
                {ROLES.find((r) => r.id === activeRole)!.description}
              </p>
            )}
          </div>

          {/* Domain Configuration */}
          <div className="mt-3">
            <DomainConfigPanel domains={domains} onDomainsChange={setDomains} />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8">
        {/* Category Tabs */}
        <Tabs
          value={activeCategory}
          onValueChange={setActiveCategory}
          className="mb-6"
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="gap-1.5 text-xs sm:text-sm px-2 sm:px-4 py-2"
              >
                {cat.icon}
                <span className="hidden sm:inline">{cat.label}</span>
                {cat.id === 'all' && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {roleFiltered.length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-6">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredCases.map((uc) => {
                const Component = uc.component
                const isExpanded = expandedCard === uc.id

                return (
                  <Card
                    key={uc.id}
                    className={
                      isExpanded
                        ? 'lg:col-span-2 shadow-lg border-primary/20'
                        : 'hover:shadow-md transition-shadow'
                    }
                  >
                    <CardHeader
                      className="cursor-pointer select-none"
                      onClick={() =>
                        setExpandedCard(isExpanded ? null : uc.id)
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            {uc.icon}
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {uc.title}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                              {uc.description}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                          {uc.category}
                        </Badge>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent
                        onClick={(e) => e.stopPropagation()}
                        className="pt-0"
                      >
                        <Component domains={domains} />
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer info */}
        <div className="mt-8 rounded-lg bg-muted/50 border p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">Requirements</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Active Directory module for Windows PowerShell (<code className="bg-muted px-1 rounded text-xs">Import-Module ActiveDirectory</code>)</li>
            <li>Domain Administrator or delegated permissions for the operations</li>
            <li>Windows Server 2008 R2+ or Windows 7+ with RSAT installed</li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          PowerShell AD Command Generator — All commands are generated client-side, no data is sent to any server.
        </div>
      </footer>
    </div>
  )
}

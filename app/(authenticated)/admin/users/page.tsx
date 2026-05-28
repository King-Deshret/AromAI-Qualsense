'use client';

/**
 * User Management Page (/admin/users)
 *
 * Admin-only page for managing user accounts and role assignments.
 * Uses /api/admin/users (Supabase Admin API + DaaS) instead of
 * ItemsService('daas_users') which fails on system collections.
 *
 * Features:
 * - List users with email, name, role, status
 * - Create new users with email, name, role
 * - Edit users: modify name, role, status
 * - Enforce unique email (case-insensitive)
 * - Prevent admin from demoting themselves or deactivating themselves
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconRefresh,
  IconUserPlus,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { Toggle } from '@/components/ui/toggle';

/** Role options for the dropdown */
const ROLE_OPTIONS = [
  { text: 'Operator', value: 'operator' },
  { text: 'QC Manager', value: 'qc_manager' },
  { text: 'Admin', value: 'admin' },
];

/** Role badge color mapping */
const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  qc_manager: 'blue',
  operator: 'green',
};

/** Role display labels */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  qc_manager: 'QC Manager',
  operator: 'Operator',
};

/** Validation errors for user form */
interface UserFormErrors {
  email?: string;
  first_name?: string;
  role?: string;
  is_active?: string;
}

/** User record from the API */
interface UserRecord {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  status: string;
}

/**
 * Validates email format according to RFC 5322 simplified pattern.
 * Max 254 characters per RFC 5321.
 */
function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates the user create form.
 */
function validateCreateForm(form: {
  email: string;
  first_name: string;
  role: string | null;
}): UserFormErrors {
  const errors: UserFormErrors = {};

  if (!form.email || form.email.trim() === '') {
    errors.email = 'Email is required';
  } else if (!isValidEmail(form.email.trim())) {
    errors.email = 'Please enter a valid email address';
  } else if (form.email.trim().length > 254) {
    errors.email = 'Email must not exceed 254 characters';
  }

  if (!form.first_name || form.first_name.trim() === '') {
    errors.first_name = 'Name is required';
  } else if (form.first_name.trim().length > 100) {
    errors.first_name = 'Name must not exceed 100 characters';
  }

  if (!form.role) {
    errors.role = 'Role is required';
  } else if (!['operator', 'qc_manager', 'admin'].includes(form.role)) {
    errors.role = 'Invalid role selected';
  }

  return errors;
}

/**
 * Validates the user edit form.
 */
function validateEditForm(form: {
  first_name: string;
  role: string | null;
}): UserFormErrors {
  const errors: UserFormErrors = {};

  if (!form.first_name || form.first_name.trim() === '') {
    errors.first_name = 'Name is required';
  } else if (form.first_name.trim().length > 100) {
    errors.first_name = 'Name must not exceed 100 characters';
  }

  if (!form.role) {
    errors.role = 'Role is required';
  } else if (!['operator', 'qc_manager', 'admin'].includes(form.role)) {
    errors.role = 'Invalid role selected';
  }

  return errors;
}

// ─── Create User Form ─────────────────────────────────────────────────────────

function CreateUserForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validateCreateForm({ email, first_name: firstName, role });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          role,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errMsg = json?.errors?.[0]?.message ?? 'Failed to create user. Please try again.';
        const errCode = json?.errors?.[0]?.extensions?.code;
        const errField = json?.errors?.[0]?.extensions?.field;
        if (errCode === 'RECORD_NOT_UNIQUE' || errField === 'email') {
          setErrors({ email: 'A user with this email already exists' });
        } else {
          setServerError(errMsg);
        }
        return;
      }

      onSuccess();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper p="xl" shadow="xs" radius="md" maw={600}>
      <Stack gap="md">
        <Title order={3}>Create New User</Title>

        {serverError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" data-testid="server-error">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <Input
              label="Email"
              placeholder="user@example.com"
              value={email}
              onChange={(val) => {
                setEmail(String(val ?? ''));
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              required
              maxLength={254}
              error={errors.email}
              data-testid="user-email-input"
            />

            <Input
              label="Name"
              placeholder="Enter full name"
              value={firstName}
              onChange={(val) => {
                setFirstName(String(val ?? ''));
                if (errors.first_name) setErrors((prev) => ({ ...prev, first_name: undefined }));
              }}
              required
              maxLength={100}
              error={errors.first_name}
              data-testid="user-name-input"
            />

            <SelectDropdown
              label="Role"
              placeholder="Select role"
              choices={ROLE_OPTIONS}
              value={role}
              onChange={(val) => {
                setRole(val as string | null);
                if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
              }}
              required
              error={errors.role}
              data-testid="user-role-select"
            />

            {Object.keys(errors).length > 0 && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" data-testid="validation-summary">
                <Text size="sm" fw={500} mb={4}>Please fix the following errors:</Text>
                <Stack gap={2}>
                  {errors.email && <Text size="sm">• {errors.email}</Text>}
                  {errors.first_name && <Text size="sm">• {errors.first_name}</Text>}
                  {errors.role && <Text size="sm">• {errors.role}</Text>}
                </Stack>
              </Alert>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                leftSection={<IconCheck size={16} />}
                data-testid="create-user-btn"
              >
                Create User
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}

// ─── Edit User Form ───────────────────────────────────────────────────────────

function EditUserForm({
  user,
  currentUserId,
  onSuccess,
  onCancel,
}: {
  user: UserRecord;
  currentUserId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [role, setRole] = useState<string | null>(user.role);
  const [isActive, setIsActive] = useState(user.status === 'active');
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isSelf = user.id === currentUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validateEditForm({ first_name: firstName, role });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (isSelf && role !== user.role) {
      setErrors({ role: 'You cannot change your own role' });
      return;
    }

    if (isSelf && !isActive) {
      setErrors({ is_active: 'You cannot deactivate your own account' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          role,
          status: isActive ? 'active' : 'suspended',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errMsg = json?.errors?.[0]?.message ?? 'Failed to update user. Please try again.';
        setServerError(errMsg);
        return;
      }

      onSuccess();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper p="xl" shadow="xs" radius="md" maw={600}>
      <Stack gap="md">
        <Title order={3}>Edit User</Title>
        <Text size="sm" c="dimmed">{user.email}</Text>

        {serverError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" data-testid="server-error">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <Input
              label="Name"
              placeholder="Enter full name"
              value={firstName}
              onChange={(val) => {
                setFirstName(String(val ?? ''));
                if (errors.first_name) setErrors((prev) => ({ ...prev, first_name: undefined }));
              }}
              required
              maxLength={100}
              error={errors.first_name}
              data-testid="edit-user-name-input"
            />

            <SelectDropdown
              label="Role"
              placeholder="Select role"
              choices={ROLE_OPTIONS}
              value={role}
              onChange={(val) => {
                setRole(val as string | null);
                if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
              }}
              required
              disabled={isSelf}
              error={errors.role}
              data-testid="edit-user-role-select"
            />
            {isSelf && (
              <Text size="xs" c="dimmed">You cannot change your own role.</Text>
            )}

            <Toggle
              label="Active"
              description={isSelf ? 'You cannot deactivate your own account' : 'Deactivating a user prevents them from logging in'}
              value={isActive}
              onChange={(val) => {
                if (isSelf) return;
                setIsActive(val);
                if (errors.is_active) setErrors((prev) => ({ ...prev, is_active: undefined }));
              }}
              disabled={isSelf}
              data-testid="edit-user-active-toggle"
            />
            {errors.is_active && (
              <Text size="xs" c="red">{errors.is_active}</Text>
            )}

            {Object.keys(errors).length > 0 && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" data-testid="validation-summary">
                <Text size="sm" fw={500} mb={4}>Please fix the following errors:</Text>
                <Stack gap={2}>
                  {errors.first_name && <Text size="sm">• {errors.first_name}</Text>}
                  {errors.role && <Text size="sm">• {errors.role}</Text>}
                  {errors.is_active && <Text size="sm">• {errors.is_active}</Text>}
                </Stack>
              </Alert>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                leftSection={<IconCheck size={16} />}
                data-testid="save-user-btn"
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}

// ─── User List ────────────────────────────────────────────────────────────────

function UserList({
  users,
  loading,
  error,
  onRefresh,
  onUserClick,
}: {
  users: UserRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onUserClick: (user: UserRecord) => void;
}) {
  if (loading) {
    return (
      <Stack align="center" justify="center" h={200}>
        <Loader size="lg" />
        <Text c="dimmed">Loading users...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
        {error}
        <Button size="xs" variant="subtle" ml="sm" onClick={onRefresh}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (users.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No users found.
      </Text>
    );
  }

  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Email</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((user) => {
            const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
            const isActive = user.status === 'active';
            return (
              <Table.Tr
                key={user.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onUserClick(user)}
                data-testid={`user-row-${user.id}`}
              >
                <Table.Td>
                  <Text size="sm">{user.email}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{name || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  {user.role ? (
                    <Badge color={ROLE_COLORS[user.role] || 'gray'} variant="light" size="sm">
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={isActive ? 'green' : 'gray'} variant="light" size="sm">
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Fetch current user ID on mount
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch('/api/auth/user', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setCurrentUserId(json.data?.id ?? '');
        }
      } catch {
        // Silently ignore — self-protection checks will be skipped
      }
    }
    fetchCurrentUser();
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) {
        setUsersError(json?.errors?.[0]?.message ?? `Failed to load users (HTTP ${res.status})`);
        return;
      }
      setUsers(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Load users when on list view
  useEffect(() => {
    if (view === 'list') {
      fetchUsers();
    }
  }, [view, fetchUsers]);

  const handleUserClick = useCallback((user: UserRecord) => {
    setSelectedUser(user);
    setView('edit');
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setView('list');
  }, []);

  const handleEditSuccess = useCallback(() => {
    setView('list');
    setSelectedUser(null);
  }, []);

  const handleCancel = useCallback(() => {
    setView('list');
    setSelectedUser(null);
  }, []);

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>User Management</Title>
            <Text c="dimmed" size="sm">
              {view === 'list' && 'Manage user accounts, roles, and access.'}
              {view === 'create' && 'Create a new user account.'}
              {view === 'edit' && 'Edit user details and permissions.'}
            </Text>
          </Stack>
          {view !== 'list' && (
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={handleCancel}
            >
              Back to Users
            </Button>
          )}
        </Group>
      </Stack>

      {view === 'list' && (
        <Stack gap="md">
          <Group justify="flex-end">
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchUsers}
              loading={loadingUsers}
            >
              Refresh
            </Button>
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={() => setView('create')}
              data-testid="add-user-btn"
            >
              Add User
            </Button>
          </Group>
          <UserList
            users={users}
            loading={loadingUsers}
            error={usersError}
            onRefresh={fetchUsers}
            onUserClick={handleUserClick}
          />
        </Stack>
      )}

      {view === 'create' && (
        <CreateUserForm onSuccess={handleCreateSuccess} onCancel={handleCancel} />
      )}

      {view === 'edit' && selectedUser && (
        <EditUserForm
          user={selectedUser}
          currentUserId={currentUserId}
          onSuccess={handleEditSuccess}
          onCancel={handleCancel}
        />
      )}
    </Stack>
  );
}

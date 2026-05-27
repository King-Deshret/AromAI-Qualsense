'use client';

/**
 * User Management Page (/admin/users)
 *
 * Admin-only page for managing user accounts and role assignments.
 * Uses Buildpad CollectionList for listing and custom forms for create/edit.
 *
 * Features:
 * - List users with email, name, role, is_active status
 * - Create new users with email, name, role
 * - Edit users: modify name, role, is_active
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
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconUserPlus,
} from '@tabler/icons-react';
import { CollectionList } from '@/components/ui/collection-list';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { Toggle } from '@/components/ui/toggle';
import { ItemsService } from '@/lib/buildpad/services';
import type { AnyItem } from '@/lib/buildpad/types';
import type { Header } from '@/components/ui/vtable-types';

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

  // Email validation
  if (!form.email || form.email.trim() === '') {
    errors.email = 'Email is required';
  } else if (!isValidEmail(form.email.trim())) {
    errors.email = 'Please enter a valid email address';
  } else if (form.email.trim().length > 254) {
    errors.email = 'Email must not exceed 254 characters';
  }

  // Name validation (1-100 chars)
  if (!form.first_name || form.first_name.trim() === '') {
    errors.first_name = 'Name is required';
  } else if (form.first_name.trim().length > 100) {
    errors.first_name = 'Name must not exceed 100 characters';
  }

  // Role validation
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

  // Name validation (1-100 chars)
  if (!form.first_name || form.first_name.trim() === '') {
    errors.first_name = 'Name is required';
  } else if (form.first_name.trim().length > 100) {
    errors.first_name = 'Name must not exceed 100 characters';
  }

  // Role validation
  if (!form.role) {
    errors.role = 'Role is required';
  } else if (!['operator', 'qc_manager', 'admin'].includes(form.role)) {
    errors.role = 'Invalid role selected';
  }

  return errors;
}

/**
 * Create User Form Component
 */
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

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const itemsService = new ItemsService('daas_users');
      await itemsService.createOne({
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        role,
        status: 'active',
      });

      onSuccess();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const serverErrors = (
          err as { errors: Array<{ message?: string; extensions?: { code?: string; field?: string } }> }
        ).errors;
        if (Array.isArray(serverErrors) && serverErrors.length > 0) {
          // Check for duplicate email error
          const duplicateError = serverErrors.find(
            (e) => e.extensions?.code === 'RECORD_NOT_UNIQUE' || e.message?.toLowerCase().includes('unique')
          );
          if (duplicateError) {
            setErrors({ email: 'A user with this email already exists' });
          } else {
            setServerError(serverErrors.map((e) => e.message).join('. '));
          }
        } else {
          setServerError('Failed to create user. Please try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred.');
      }
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

/**
 * Edit User Form Component
 */
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

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // Prevent self-demotion
    if (isSelf && role !== user.role) {
      setErrors({ role: 'You cannot change your own role' });
      return;
    }

    // Prevent self-deactivation
    if (isSelf && !isActive) {
      setErrors({ is_active: 'You cannot deactivate your own account' });
      return;
    }

    setSubmitting(true);

    try {
      const itemsService = new ItemsService('daas_users');
      await itemsService.updateOne(user.id, {
        first_name: firstName.trim(),
        role,
        status: isActive ? 'active' : 'suspended',
      });

      onSuccess();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const serverErrors = (
          err as { errors: Array<{ message?: string }> }
        ).errors;
        if (Array.isArray(serverErrors) && serverErrors.length > 0) {
          setServerError(serverErrors.map((e) => e.message).join('. '));
        } else {
          setServerError('Failed to update user. Please try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred.');
      }
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

/**
 * User Management Page
 */
export default function UserManagementPage() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [listKey, setListKey] = useState(0);

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

  const handleItemClick = useCallback(async (item: AnyItem) => {
    // Load full user record for editing
    try {
      const itemsService = new ItemsService('daas_users');
      const user = await itemsService.readOne(item.id as string, [
        'id', 'email', 'first_name', 'last_name', 'role', 'status',
      ]);
      setSelectedUser(user as unknown as UserRecord);
      setView('edit');
    } catch {
      // If we can't load the user, use what we have from the list
      setSelectedUser({
        id: item.id as string,
        email: (item.email as string) || '',
        first_name: (item.first_name as string) || null,
        last_name: (item.last_name as string) || null,
        role: (item.role as string) || null,
        status: (item.status as string) || 'active',
      });
      setView('edit');
    }
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setView('list');
    setListKey((k) => k + 1); // Force CollectionList refresh
  }, []);

  const handleEditSuccess = useCallback(() => {
    setView('list');
    setSelectedUser(null);
    setListKey((k) => k + 1); // Force CollectionList refresh
  }, []);

  const handleCancel = useCallback(() => {
    setView('list');
    setSelectedUser(null);
  }, []);

  /**
   * Custom cell renderer for role badges and active status.
   */
  const renderCell = useCallback(
    (item: AnyItem, header: Header) => {
      // Role as badge
      if (header.value === 'role') {
        const role = item.role as string | null;
        if (!role) return <Text size="sm" c="dimmed">—</Text>;
        return (
          <Badge color={ROLE_COLORS[role] || 'gray'} variant="light" size="sm">
            {ROLE_LABELS[role] || role}
          </Badge>
        );
      }

      // Status as active/inactive badge
      if (header.value === 'status') {
        const status = item.status as string;
        const isActive = status === 'active';
        return (
          <Badge color={isActive ? 'green' : 'gray'} variant="light" size="sm">
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      }

      // Full name display
      if (header.value === 'first_name') {
        const firstName = item.first_name as string | null;
        const lastName = item.last_name as string | null;
        const name = [firstName, lastName].filter(Boolean).join(' ');
        return (
          <Text size="sm" truncate="end">
            {name || '—'}
          </Text>
        );
      }

      return null;
    },
    [],
  );

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
              leftSection={<IconUserPlus size={16} />}
              onClick={() => setView('create')}
              data-testid="add-user-btn"
            >
              Add User
            </Button>
          </Group>
          <CollectionList
            key={listKey}
            collection="daas_users"
            fields={['email', 'first_name', 'role', 'status']}
            enableSearch
            enableSort
            enableFilter={false}
            enableCreate={false}
            enableSelection={false}
            enableDelete={false}
            limit={25}
            primaryKeyField="id"
            onItemClick={handleItemClick}
            renderCell={renderCell}
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

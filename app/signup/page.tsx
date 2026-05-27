'use client';

/**
 * Signup Page
 * 
 * Allows new users to create an account. All new signups are assigned
 * the OPERATOR role by default.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
  Anchor,
  PasswordInput,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.errors?.[0]?.message || 'Signup failed');
        return;
      }

      setSuccess(true);
      // Auto-redirect to dashboard after successful signup
      setTimeout(() => router.replace('/dashboard'), 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Stack align="center" justify="center" mih="100vh" p="xl">
        <Paper shadow="md" p="xl" radius="md" w={400}>
          <Stack gap="md" align="center">
            <Title order={3}>Account Created!</Title>
            <Text c="dimmed">Redirecting to dashboard...</Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack align="center" justify="center" mih="100vh" p="xl">
      <Paper shadow="md" p="xl" radius="md" w={400}>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Title order={2} ta="center">AromAI QC Platform</Title>
            <Text c="dimmed" ta="center" size="sm">
              Create your account
            </Text>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}

            <TextInput
              label="First Name"
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.currentTarget.value)}
              required
            />

            <TextInput
              label="Last Name"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.currentTarget.value)}
              required
            />

            <TextInput
              label="Email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              minLength={6}
            />

            <Button type="submit" fullWidth loading={loading}>
              Sign Up
            </Button>

            <Text ta="center" size="sm">
              Already have an account?{' '}
              <Anchor href="/login">Sign in</Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}

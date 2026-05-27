'use client';

import { useState } from 'react';
import {
  Paper,
  Button,
  Title,
  Text,
  Container,
  Stack,
  Box,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

/**
 * Role-to-redirect mapping for post-login navigation.
 * OPERATOR → lot overview, QC_MANAGER → review queue, ADMIN → system dashboard
 */
const ROLE_REDIRECTS: Record<string, string> = {
  operator: '/lots',
  qc_manager: '/review',
  admin: '/dashboard',
};

/**
 * Determines the redirect path based on user role name.
 * Falls back to '/' if role is unknown.
 */
function getRedirectPath(roleName: string | null | undefined): string {
  if (!roleName) return '/';
  const normalized = roleName.toLowerCase();
  return ROLE_REDIRECTS[normalized] || '/';
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');

  const validateForm = (): boolean => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    setFormError('');

    if (!email.trim()) {
      setEmailError('Email is required');
      valid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setFormError('');

    try {
      // Step 1: Authenticate via proxy route
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'include',
      });

      if (!loginResponse.ok) {
        // Generic error message — no distinction between wrong email vs wrong password
        setFormError('Invalid email or password');
        return;
      }

      // Step 2: Fetch user info to determine role for redirect
      const userResponse = await fetch('/api/auth/user', {
        credentials: 'include',
      });

      let redirectPath = '/';

      if (userResponse.ok) {
        const userData = await userResponse.json();
        const user = userData.data;

        // Determine role from user data
        // The /api/auth/user route returns roles array or role field
        let roleName: string | null = null;

        if (user?.roles && Array.isArray(user.roles) && user.roles.length > 0) {
          // Multi-role: use first role's name
          roleName = user.roles[0]?.name || null;
        } else if (user?.role && typeof user.role === 'object') {
          roleName = user.role.name || null;
        } else if (user?.role && typeof user.role === 'string') {
          roleName = user.role;
        }

        // Check admin_access flag as fallback
        if (!roleName && user?.admin_access) {
          roleName = 'admin';
        }

        redirectPath = getRedirectPath(roleName);
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setFormError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
      }}
    >
      <Container size={420}>
        <Title ta="center" mb="md">
          AromAI QC Platform
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Sign in to your account
        </Text>

        <Paper withBorder shadow="md" p={30} radius="md">
          <form onSubmit={handleSubmit} noValidate>
            <Stack>
              {formError && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="red"
                  variant="light"
                >
                  {formError}
                </Alert>
              )}

              <Input
                label="Email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(val) => {
                  setEmail(typeof val === 'string' ? val : '');
                  if (emailError) setEmailError('');
                }}
                error={emailError}
                disabled={loading}
              />

              <Input
                label="Password"
                placeholder="Your password"
                required
                masked
                value={password}
                onChange={(val) => {
                  setPassword(typeof val === 'string' ? val : '');
                  if (passwordError) setPasswordError('');
                }}
                error={passwordError}
                disabled={loading}
              />

              <Button type="submit" fullWidth loading={loading} mt="sm">
                Sign in
              </Button>

              <Text ta="center" size="sm" mt="sm">
                Don&apos;t have an account?{' '}
                <a href="/signup" style={{ color: 'var(--mantine-color-blue-6)' }}>Sign up</a>
              </Text>
            </Stack>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}

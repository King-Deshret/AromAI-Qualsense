'use client';

import { useState } from 'react';
import {
  Paper, Button, Title, Text, Container,
  Stack, Box, Alert, Anchor,
} from '@mantine/core';
import { IconAlertCircle, IconMailCheck } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

const ROLE_REDIRECTS: Record<string, string> = {
  operator: '/lots',
  qc_manager: '/review',
  admin: '/dashboard',
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState(false);

  const validate = (): boolean => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    setFormError('');
    setEmailNotVerified(false);

    if (!email.trim()) {
      setEmailError('Email wajib diisi');
      valid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Format email tidak valid');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password wajib diisi');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        const code = json?.errors?.[0]?.code;
        if (code === 'email_not_verified' || res.status === 403) {
          // Email not verified — show "Cek email kamu"
          setEmailNotVerified(true);
        } else {
          setFormError(json?.errors?.[0]?.message || 'Email atau password salah.');
        }
        return;
      }

      // Read role and redirect accordingly
      const role = json?.data?.user?.role as string | null;
      const normalized = role?.toLowerCase() ?? '';
      const redirectPath = ROLE_REDIRECTS[normalized] || '/dashboard';
      router.push(redirectPath);
      router.refresh();
    } catch {
      setFormError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Email not verified state
  if (emailNotVerified) {
    return (
      <Box style={pageStyle}>
        <Container size={420}>
          <Paper withBorder shadow="md" p={30} radius="md">
            <Stack align="center" gap="md">
              <IconMailCheck size={48} color="var(--mantine-color-blue-6)" />
              <Title order={3} ta="center">Cek email kamu</Title>
              <Text c="dimmed" ta="center" size="sm">
                Email kamu belum diverifikasi. Silakan cek inbox dan klik link verifikasi
                yang sudah dikirim ke <strong>{email}</strong>.
              </Text>
              <Button variant="light" fullWidth onClick={() => setEmailNotVerified(false)}>
                Kembali ke Login
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={pageStyle}>
      <Container size={420}>
        <Title ta="center" mb="xs">AromAI QC Platform</Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Masuk ke akun kamu
        </Text>

        <Paper withBorder shadow="md" p={30} radius="md">
          <form onSubmit={handleSubmit} noValidate>
            <Stack>
              {formError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  {formError}
                </Alert>
              )}

              <Input
                label="Email"
                placeholder="kamu@contoh.com"
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
                placeholder="Password kamu"
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
                Masuk
              </Button>

              <Text ta="center" size="sm">
                Belum punya akun?{' '}
                <Anchor href="/signup" size="sm">Daftar sekarang</Anchor>
              </Text>
            </Stack>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}

const pageStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
};

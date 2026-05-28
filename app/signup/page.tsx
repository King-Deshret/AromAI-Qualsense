'use client';

import { useEffect, useState } from 'react';
import {
  Paper, Button, Title, Text, Container,
  Stack, Box, Alert, Anchor, Loader,
  Radio, Group,
} from '@mantine/core';
import { IconAlertCircle, IconMailCheck } from '@tabler/icons-react';
import { Input } from '@/components/ui/input';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin — Akses penuh sistem',
  qc_manager: 'QC Manager — Review & laporan',
  operator: 'Operator — Input lot & inspeksi',
};

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [checkingSlots, setCheckingSlots] = useState(true);
  const [adminAvailable, setAdminAvailable] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('operator');
  const [error, setError] = useState<string | null>(null);

  // Check admin slot availability on mount
  useEffect(() => {
    async function checkSlots() {
      try {
        const res = await fetch('/api/auth/signup');
        if (res.ok) {
          const json = await res.json();
          setAdminAvailable(json.adminAvailable === true);
          // Default role: if admin not available, default to qc_manager
          if (!json.adminAvailable) setRole('qc_manager');
        }
      } catch {
        setAdminAvailable(false);
      } finally {
        setCheckingSlots(false);
      }
    }
    checkSlots();
  }, []);

  const availableRoles = adminAvailable
    ? ['admin', 'qc_manager', 'operator']
    : ['qc_manager', 'operator'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) { setError('Nama depan wajib diisi.'); return; }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Format email tidak valid.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.errors?.[0]?.message || 'Gagal membuat akun.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Success — email verification sent
  if (submitted) {
    return (
      <Box style={pageStyle}>
        <Container size={420}>
          <Paper withBorder shadow="md" p={30} radius="md">
            <Stack align="center" gap="md">
              <IconMailCheck size={48} color="var(--mantine-color-green-6)" />
              <Title order={3} ta="center">Cek email kamu!</Title>
              <Text c="dimmed" ta="center" size="sm">
                Link verifikasi sudah dikirim ke <strong>{email}</strong>.
                Klik link tersebut untuk mengaktifkan akun kamu.
              </Text>
              <Anchor href="/login" size="sm">Kembali ke halaman login</Anchor>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={pageStyle}>
      <Container size={460}>
        <Title ta="center" mb="xs">AromAI QC Platform</Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Buat akun baru
        </Text>

        <Paper withBorder shadow="md" p={30} radius="md">
          {checkingSlots ? (
            <Stack align="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Memeriksa ketersediaan slot...</Text>
            </Stack>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <Stack gap="md">
                {error && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                    {error}
                  </Alert>
                )}

                <Group grow>
                  <Input
                    label="Nama Depan"
                    placeholder="John"
                    required
                    value={firstName}
                    onChange={(val) => setFirstName(typeof val === 'string' ? val : '')}
                  />
                  <Input
                    label="Nama Belakang"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(val) => setLastName(typeof val === 'string' ? val : '')}
                  />
                </Group>

                <Input
                  label="Email"
                  placeholder="kamu@contoh.com"
                  required
                  value={email}
                  onChange={(val) => setEmail(typeof val === 'string' ? val : '')}
                />

                <Input
                  label="Password"
                  placeholder="Minimal 6 karakter"
                  required
                  masked
                  value={password}
                  onChange={(val) => setPassword(typeof val === 'string' ? val : '')}
                />

                {/* Role selection */}
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Pilih Role
                    {!adminAvailable && (
                      <Text span size="xs" c="dimmed" ml={6}>(Slot admin penuh)</Text>
                    )}
                  </Text>
                  <Radio.Group value={role} onChange={setRole}>
                    <Stack gap="xs">
                      {availableRoles.map((r) => (
                        <Radio
                          key={r}
                          value={r}
                          label={ROLE_LABELS[r]}
                        />
                      ))}
                    </Stack>
                  </Radio.Group>
                </Stack>

                <Button type="submit" fullWidth loading={loading} mt="sm">
                  Daftar
                </Button>

                <Text ta="center" size="sm">
                  Sudah punya akun?{' '}
                  <Anchor href="/login" size="sm">Masuk</Anchor>
                </Text>
              </Stack>
            </form>
          )}
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

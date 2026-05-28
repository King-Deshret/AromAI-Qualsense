'use client';

import { useEffect, useState } from 'react';
import {
  Paper, Button, Title, Text, Container,
  Stack, Box, Anchor, Loader, Group,
} from '@mantine/core';
import {
  IconMailCheck,
  IconMail,
  IconLock,
  IconUser,
  IconShield,
  IconClipboardCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';

const ROLE_CONFIG: Record<string, {
  icon: React.ReactNode;
  title: string;
  description: string;
}> = {
  admin: {
    icon: <IconShield size={22} />,
    title: 'Admin',
    description: 'Akses penuh sistem',
  },
  qc_manager: {
    icon: <IconClipboardCheck size={22} />,
    title: 'QC Manager',
    description: 'Review & laporan kualitas',
  },
  operator: {
    icon: <IconUser size={22} />,
    title: 'Operator',
    description: 'Input lot & inspeksi',
  },
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

  useEffect(() => {
    async function checkSlots() {
      try {
        const res = await fetch('/api/auth/signup');
        if (res.ok) {
          const json = await res.json();
          setAdminAvailable(json.adminAvailable === true);
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

  // Success state
  if (submitted) {
    return (
      <Box style={pageStyle}>
        <Box style={blobTopRight} />
        <Box style={blobBottomLeft} />
        <Container size={420} style={{ position: 'relative', zIndex: 1 }}>
          <Paper style={cardStyle} p={40} radius="lg">
            <Stack align="center" gap="lg">
              <Box style={iconCircleStyle}>
                <IconMailCheck size={32} color="#f97316" />
              </Box>
              <Title
                order={3}
                ta="center"
                style={{
                  fontWeight: 900,
                  fontStyle: 'italic',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#fff',
                }}
              >
                Cek Email Kamu!
              </Title>
              <Text ta="center" size="sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Link verifikasi sudah dikirim ke{' '}
                <Text span fw={600} style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {email}
                </Text>
                . Klik link tersebut untuk mengaktifkan akun kamu.
              </Text>
              <Anchor
                href="/login"
                size="sm"
                style={{ color: '#f97316', fontWeight: 600 }}
              >
                Kembali ke halaman login
              </Anchor>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={pageStyle}>
      <Box style={blobTopRight} />
      <Box style={blobBottomLeft} />

      <Container size={480} style={{ position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <Stack align="center" mb="xl" gap={4}>
          <Box style={logoStyle}>
            <Text style={{ fontSize: 22, fontWeight: 900, color: '#f97316', fontStyle: 'italic' }}>
              AQ
            </Text>
          </Box>
          <Title
            order={1}
            style={{
              fontWeight: 900,
              fontStyle: 'italic',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#fff',
              fontSize: '1.6rem',
            }}
          >
            DAFTAR AKUN
          </Title>
          <Text size="sm" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
            AromAI QC Platform
          </Text>
        </Stack>

        <Paper style={cardStyle} p={36} radius="lg">
          {checkingSlots ? (
            <Stack align="center" py="xl" gap="md">
              <Loader size="sm" color="orange" />
              <Text size="sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Memeriksa ketersediaan slot...
              </Text>
            </Stack>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <Stack gap="md">
                {error && (
                  <Box style={errorBoxStyle}>
                    <IconAlertCircle size={16} style={{ flexShrink: 0, color: '#f87171' }} />
                    <Text size="sm" style={{ color: '#f87171' }}>{error}</Text>
                  </Box>
                )}

                <Group grow>
                  <Input
                    label="Nama Depan"
                    placeholder="John"
                    required
                    value={firstName}
                    onChange={(val) => setFirstName(typeof val === 'string' ? val : '')}
                    iconLeft={<IconUser size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
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
                  iconLeft={<IconMail size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                />

                <Input
                  label="Password"
                  placeholder="Minimal 6 karakter"
                  required
                  masked
                  value={password}
                  onChange={(val) => setPassword(typeof val === 'string' ? val : '')}
                  iconLeft={<IconLock size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                />

                {/* Role selection — card style */}
                <Stack gap="xs">
                  <Group gap={6}>
                    <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                      Pilih Role
                    </Text>
                    {!adminAvailable && (
                      <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        (Slot admin penuh)
                      </Text>
                    )}
                  </Group>
                  <Stack gap={8}>
                    {availableRoles.map((r) => {
                      const cfg = ROLE_CONFIG[r];
                      const isSelected = role === r;
                      return (
                        <Box
                          key={r}
                          onClick={() => setRole(r)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '12px 16px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            border: isSelected
                              ? '1px solid rgba(249, 115, 22, 0.6)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            background: isSelected
                              ? 'rgba(249, 115, 22, 0.1)'
                              : 'rgba(255, 255, 255, 0.03)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Box
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isSelected
                                ? 'rgba(249, 115, 22, 0.2)'
                                : 'rgba(255, 255, 255, 0.06)',
                              color: isSelected ? '#f97316' : 'rgba(255,255,255,0.5)',
                              flexShrink: 0,
                            }}
                          >
                            {cfg.icon}
                          </Box>
                          <Box style={{ flex: 1 }}>
                            <Text
                              size="sm"
                              fw={700}
                              style={{
                                color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontSize: '0.78rem',
                              }}
                            >
                              {cfg.title}
                            </Text>
                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                              {cfg.description}
                            </Text>
                          </Box>
                          {/* Selection indicator */}
                          <Box
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              border: isSelected
                                ? '2px solid #f97316'
                                : '2px solid rgba(255,255,255,0.2)',
                              background: isSelected ? '#f97316' : 'transparent',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </Stack>

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  mt="xs"
                  style={primaryBtnStyle}
                >
                  <Text
                    span
                    style={{
                      fontWeight: 900,
                      fontStyle: 'italic',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      fontSize: '0.85rem',
                    }}
                  >
                    DAFTAR
                  </Text>
                </Button>

                <Text ta="center" size="sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Sudah punya akun?{' '}
                  <Anchor href="/login" size="sm" style={{ color: '#f97316', fontWeight: 600 }}>
                    Masuk
                  </Anchor>
                </Text>
              </Stack>
            </form>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const pageStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
  overflow: 'hidden',
  overflowY: 'auto',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
};

const logoStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 14,
  background: 'rgba(249, 115, 22, 0.15)',
  border: '1px solid rgba(249, 115, 22, 0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
  border: 'none',
  boxShadow: '0 4px 20px rgba(249, 115, 22, 0.4)',
  height: 44,
};

const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(248, 113, 113, 0.1)',
  border: '1px solid rgba(248, 113, 113, 0.25)',
};

const iconCircleStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  background: 'rgba(249, 115, 22, 0.12)',
  border: '1px solid rgba(249, 115, 22, 0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const blobTopRight: React.CSSProperties = {
  position: 'absolute',
  top: -120,
  right: -120,
  width: 400,
  height: 400,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const blobBottomLeft: React.CSSProperties = {
  position: 'absolute',
  bottom: -150,
  left: -150,
  width: 500,
  height: 500,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
  pointerEvents: 'none',
};

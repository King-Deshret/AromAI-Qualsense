'use client';

import { useState } from 'react';
import {
  Paper, Button, Title, Text, Container,
  Stack, Box, Anchor,
} from '@mantine/core';
import {
  IconMailCheck,
  IconMail,
  IconLock,
  IconAlertCircle,
} from '@tabler/icons-react';
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
          setEmailNotVerified(true);
        } else {
          setFormError(json?.errors?.[0]?.message || 'Email atau password salah.');
        }
        return;
      }

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
          <Paper style={cardStyle} p={40} radius="lg">
            <Stack align="center" gap="lg">
              <Box style={iconCircleStyle}>
                <IconMailCheck size={32} color="var(--mantine-color-primary-6, #f97316)" />
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
                Cek Email Kamu
              </Title>
              <Text ta="center" size="sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Email kamu belum diverifikasi. Silakan cek inbox dan klik link verifikasi
                yang sudah dikirim ke{' '}
                <Text span fw={600} style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {email}
                </Text>
                .
              </Text>
              <Button
                fullWidth
                variant="light"
                onClick={() => setEmailNotVerified(false)}
                style={secondaryBtnStyle}
              >
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
      {/* Decorative blobs */}
      <Box style={blobTopRight} />
      <Box style={blobBottomLeft} />

      <Container size={420} style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo / brand mark */}
        <Stack align="center" mb="xl" gap={4}>
          <Box style={logoStyle}>
            <Text style={{ fontSize: 22, fontWeight: 900, color: '#c9a84c', fontStyle: 'italic' }}>
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
            AROMAI QC
          </Title>
          <Text size="sm" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
            AI-Powered Quality Control
          </Text>
        </Stack>

        <Paper style={cardStyle} p={36} radius="lg">
          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              {formError && (
                <Box style={errorBoxStyle}>
                  <IconAlertCircle size={16} style={{ flexShrink: 0, color: '#f87171' }} />
                  <Text size="sm" style={{ color: '#f87171' }}>{formError}</Text>
                </Box>
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
                iconLeft={<IconMail size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
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
                iconLeft={<IconLock size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
              />

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
                  MASUK
                </Text>
              </Button>

              <Text ta="center" size="sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Belum punya akun?{' '}
                <Anchor
                  href="/signup"
                  size="sm"
                  style={{ color: '#c9a84c', fontWeight: 600 }}
                >
                  Daftar sekarang
                </Anchor>
              </Text>
            </Stack>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}

/* ─── Styles — Sima Arôme palette ────────────────────────────────────────── */
// Primary: dark forest green #1a4a2e
// Accent:  gold #c9a84c
// Background: deep green-black #0d2818
// Card: semi-transparent green-tinted glass

const pageStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #0d2818 0%, #1a4a2e 50%, #0f3320 100%)',
  overflow: 'hidden',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(201, 168, 76, 0.2)',
  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
};

const logoStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 14,
  background: 'rgba(201, 168, 76, 0.15)',
  border: '1px solid rgba(201, 168, 76, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1a4a2e 0%, #2d6b45 100%)',
  border: '1px solid rgba(201, 168, 76, 0.4)',
  boxShadow: '0 4px 20px rgba(26, 74, 46, 0.5)',
  height: 44,
};

const secondaryBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(201, 168, 76, 0.2)',
  color: '#fff',
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
  background: 'rgba(201, 168, 76, 0.12)',
  border: '1px solid rgba(201, 168, 76, 0.3)',
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
  background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const blobBottomLeft: React.CSSProperties = {
  position: 'absolute',
  bottom: -150,
  left: -150,
  width: 500,
  height: 500,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(45,107,69,0.2) 0%, transparent 70%)',
  pointerEvents: 'none',
};

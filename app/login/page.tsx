'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { UserRole } from '@/lib/types';

const ROLE_REDIRECT: Record<UserRole, string> = {
  Operator: '/operator/dashboard',
  Manager: '/manager/dashboard',
  Admin: '/admin/dashboard',
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? 'Login gagal');
        return;
      }

      const role = data.role as UserRole;
      router.replace(ROLE_REDIRECT[role] ?? '/login');
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-gray-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <span className="text-xs font-medium text-brand-700 uppercase tracking-wide">AromAI QC</span>
          </div>
          <CardTitle className="text-xl">Masuk ke Platform</CardTitle>
          <p className="text-sm text-gray-500">Masukkan email dan password Anda</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@perusahaan.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Masuk
            </Button>

            <p className="text-center text-sm text-gray-500">
              Belum punya akun?{' '}
              <Link href="/signup" className="text-brand-600 font-medium hover:underline">
                Daftar di sini
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

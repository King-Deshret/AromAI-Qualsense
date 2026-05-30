'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const ROLE_OPTIONS = [
  { value: 'Operator', label: 'Operator' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Admin', label: 'Admin' },
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError('');
    const newErrors: Record<string, string> = {};

    if (!form.name.trim() || form.name.length > 100) newErrors.name = 'Nama 1–100 karakter';
    if (!form.email) newErrors.email = 'Email wajib diisi';
    if (form.password.length < 8) newErrors.password = 'Password minimal 8 karakter';
    if (!form.role) newErrors.role = 'Pilih role';

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          const fieldErrors: Record<string, string> = {};
          for (const err of data.errors) fieldErrors[err.field] = err.message;
          setErrors(fieldErrors);
        } else {
          setGlobalError(data.message ?? 'Pendaftaran gagal');
        }
        return;
      }

      router.replace('/login?registered=1');
    } catch {
      setGlobalError('Terjadi kesalahan. Silakan coba lagi.');
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
          <CardTitle className="text-xl">Buat Akun</CardTitle>
          <p className="text-sm text-gray-500">Isi form berikut untuk mendaftar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Nama Lengkap"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Nama lengkap Anda"
              error={errors.name}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="email@perusahaan.com"
              error={errors.email}
              required
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              placeholder="Minimal 8 karakter"
              error={errors.password}
              required
            />
            <Select
              label="Role"
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              options={ROLE_OPTIONS}
              placeholder="Pilih role..."
              error={errors.role}
              required
            />

            {globalError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {globalError}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Daftar
            </Button>

            <p className="text-center text-sm text-gray-500">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-brand-600 font-medium hover:underline">
                Masuk
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

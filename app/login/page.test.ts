import { describe, it, expect } from 'vitest';

/**
 * Role-to-redirect mapping (mirrors the login page logic)
 */
const ROLE_REDIRECTS: Record<string, string> = {
  operator: '/lots',
  qc_manager: '/review',
  admin: '/dashboard',
};

function getRedirectPath(roleName: string | null | undefined): string {
  if (!roleName) return '/';
  const normalized = roleName.toLowerCase();
  return ROLE_REDIRECTS[normalized] || '/';
}

describe('Login Page - Role Redirect Logic', () => {
  it('redirects OPERATOR to /lots', () => {
    expect(getRedirectPath('operator')).toBe('/lots');
  });

  it('redirects QC_MANAGER to /review', () => {
    expect(getRedirectPath('qc_manager')).toBe('/review');
  });

  it('redirects ADMIN to /dashboard', () => {
    expect(getRedirectPath('admin')).toBe('/dashboard');
  });

  it('handles case-insensitive role names', () => {
    expect(getRedirectPath('Operator')).toBe('/lots');
    expect(getRedirectPath('QC_MANAGER')).toBe('/review');
    expect(getRedirectPath('ADMIN')).toBe('/dashboard');
    expect(getRedirectPath('Admin')).toBe('/dashboard');
  });

  it('falls back to / for null role', () => {
    expect(getRedirectPath(null)).toBe('/');
  });

  it('falls back to / for undefined role', () => {
    expect(getRedirectPath(undefined)).toBe('/');
  });

  it('falls back to / for unknown role', () => {
    expect(getRedirectPath('unknown_role')).toBe('/');
  });

  it('falls back to / for empty string role', () => {
    expect(getRedirectPath('')).toBe('/');
  });
});

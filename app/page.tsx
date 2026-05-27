import { redirect } from 'next/navigation';

/**
 * Root page — redirects to /dashboard (auth middleware handles login redirect)
 */
export default function HomePage() {
  redirect('/dashboard');
}

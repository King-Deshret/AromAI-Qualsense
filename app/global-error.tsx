'use client';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error.message, error.stack);
  }, [error]);

  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'monospace', background: '#fff1f2', padding: '2rem' }}>
        <div style={{ maxWidth: 700, background: 'white', border: '1px solid #fca5a5', borderRadius: 8, padding: '1.5rem' }}>
          <h2 style={{ color: '#991b1b', fontSize: 18, marginBottom: 8 }}>Client-side Error</h2>
          <p style={{ color: '#7f1d1d', fontSize: 14, marginBottom: 8 }}><b>{error.message}</b></p>
          <pre style={{ background: '#fef2f2', padding: 12, fontSize: 11, overflow: 'auto', maxHeight: 300, color: '#9f1239', borderRadius: 4 }}>
            {error.stack}
          </pre>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '6px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
              Coba Lagi
            </button>
            <button onClick={() => { window.location.href = '/login'; }} style={{ padding: '6px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
              Login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

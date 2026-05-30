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
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
      <div className="max-w-lg w-full bg-white border border-red-200 rounded-lg p-6 shadow">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Terjadi Kesalahan</h2>
        <pre className="text-xs text-red-700 bg-red-50 p-3 rounded overflow-auto max-h-48 mb-4">
          {error.message}
          {error.stack ? '\n\n' + error.stack : ''}
        </pre>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Coba Lagi
          </button>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    </div>
  );
}

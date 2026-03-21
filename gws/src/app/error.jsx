'use client';

import { useState } from 'react';

export default function Error({ error, reset }) {
  const [debug, setDebug] = useState(null);
  const [loading, setLoading] = useState(false);

  console.error('App Error:', error);

  const runDiag = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debug');
      const data = await res.json();
      setDebug(data);
    } catch (e) {
      setDebug({ fetchError: e.message });
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
      fontFamily: 'system-ui, sans-serif',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: '#888', marginBottom: 8 }}>
          The page encountered an unexpected error. Please try again.
        </p>
        {error?.digest && (
          <p style={{ color: '#555', fontSize: 12, marginBottom: 16 }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '8px 20px',
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Try again
          </button>
          <a
            href="/login"
            style={{
              padding: '8px 20px',
              backgroundColor: 'transparent',
              color: '#888',
              border: '1px solid #555',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Back to Login
          </a>
        </div>
        <button
          onClick={runDiag}
          disabled={loading}
          style={{
            padding: '6px 16px',
            backgroundColor: 'transparent',
            color: '#666',
            border: '1px solid #444',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {loading ? 'Diagnosing...' : 'Run Diagnostics'}
        </button>
        {debug && (
          <pre style={{
            textAlign: 'left',
            fontSize: 11,
            color: '#aaa',
            background: '#1a1a1a',
            padding: 12,
            borderRadius: 8,
            marginTop: 12,
            overflow: 'auto',
            maxHeight: 300,
          }}>
            {JSON.stringify(debug, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

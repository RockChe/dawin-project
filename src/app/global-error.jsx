'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#0a0a0a',
        color: '#ededed',
        margin: 0,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#888', marginBottom: 16 }}>
            {error?.message || 'An unexpected error occurred.'}
          </p>
          {error?.digest && (
            <p style={{ color: '#555', fontSize: 12, marginBottom: 16 }}>
              Digest: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px',
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
        </div>
      </body>
    </html>
  );
}

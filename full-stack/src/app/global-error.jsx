'use client';

export default function GlobalError({ error, reset }) {
  console.error('Global Error:', error);

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
          <p style={{ color: '#888', marginBottom: 8 }}>
            The application encountered an unexpected error. Please try again.
          </p>
          {error?.digest && (
            <p style={{ color: '#555', fontSize: 12, marginBottom: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
            <a
              href="/"
              style={{
                padding: '10px 24px',
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
              Back to Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

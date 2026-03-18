'use client';

export default function Error({ error, reset }) {
  console.error('App Error:', error);

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
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
            href="/"
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
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

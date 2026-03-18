'use client';

export default function Error({ error, reset }) {
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
      </div>
    </div>
  );
}

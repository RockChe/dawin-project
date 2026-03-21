'use client';

export default function AuthError({ error, reset }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F3EF',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 448,
          padding: 32,
          borderRadius: 16,
          background: '#FFFFFF',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#37352F', marginBottom: 8 }}>
          頁面載入失敗
        </h2>
        <p style={{ color: '#6B6B6B', fontSize: 14, marginBottom: 24 }}>
          登入頁面發生錯誤，請重試。
        </p>
        {error?.message && (
          <p style={{ color: '#9B9A97', fontSize: 12, marginBottom: 16 }}>
            {error.message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px',
              background: '#2383E2',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            重試
          </button>
          <a
            href="/login"
            style={{
              padding: '10px 24px',
              background: 'transparent',
              color: '#6B6B6B',
              border: '1px solid #E3E2DE',
              borderRadius: 8,
              fontSize: 14,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            重新載入
          </a>
        </div>
      </div>
    </div>
  );
}

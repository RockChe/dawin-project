export default function AuthLoading() {
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
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid #E3E2DE',
            borderTopColor: '#2383E2',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: '#6B6B6B', fontSize: 14 }}>載入中...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

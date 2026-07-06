export default function NotFound() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Seite nicht gefunden</h1>
      <p style={p}>Diese Seite gibt es nicht. Finde Sparrings in der Sparr-App.</p>
    </main>
  );
}

const wrap = {
  maxWidth: 560,
  margin: '0 auto',
  padding: 24,
  minHeight: '100vh',
} as const;
const h1 = { fontSize: 28, lineHeight: 1.2, margin: '8px 0 16px', color: '#141414' } as const;
const p = { fontSize: 15, color: '#8A8A8A' } as const;

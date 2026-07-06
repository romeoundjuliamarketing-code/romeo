export default function Home() {
  return (
    <main style={wrap}>
      <p style={kicker}>SPARR</p>
      <h1 style={h1}>Finde Sparringspartner in deiner Nähe</h1>
      <p style={p}>
        Diese Seite zeigt einzelne geteilte Sparrings an. Die App selbst gibt es im App Store und
        bei Google Play.
      </p>
    </main>
  );
}

const wrap = {
  maxWidth: 560,
  margin: '0 auto',
  padding: 24,
  minHeight: '100vh',
} as const;
const kicker = { color: '#4A90D9', letterSpacing: 2, fontWeight: 700, fontSize: 14 } as const;
const h1 = { fontSize: 28, lineHeight: 1.2, margin: '8px 0 16px', color: '#141414' } as const;
const p = { fontSize: 15, color: '#8A8A8A' } as const;

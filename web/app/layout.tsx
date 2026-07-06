import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Sparr',
  description: 'Finde Sparringspartner in deiner Nähe.',
};

// TODO: replace with the real hosted Impressum URL once it exists (see Impressum-Sparr.md in the repo root).
const IMPRESSUM_URL = '#';
const DATENSCHUTZ_URL =
  'https://www.notion.so/Datenschutzerkl-rung-Sparr-34f1f56f1531804ebd59ec7351220d82?source=copy_link';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={inter.variable}>
      <body style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>
        {children}
        <footer style={footer}>
          <a href={IMPRESSUM_URL} style={footerLink}>
            Impressum
          </a>
          <span style={footerDivider}>·</span>
          <a href={DATENSCHUTZ_URL} style={footerLink} target="_blank" rel="noopener noreferrer">
            Datenschutz
          </a>
        </footer>
      </body>
    </html>
  );
}

const footer = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
  padding: 24,
  fontSize: 13,
  color: '#8A8A8A',
} as const;
const footerLink = { color: '#8A8A8A' } as const;
const footerDivider = { color: '#8A8A8A' } as const;

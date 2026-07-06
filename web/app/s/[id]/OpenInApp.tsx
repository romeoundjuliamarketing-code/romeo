'use client';
import { useEffect, useState } from 'react';

const IOS_STORE = 'https://apps.apple.com/app/id0000000000'; // TODO: echte App-ID
const ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.kombat.app';

export default function OpenInApp({ sparringId }: { sparringId: string | null }) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
    else setPlatform('desktop');
  }, []);

  function openApp() {
    if (!sparringId) return;
    const deepLink = `sparr://s/${sparringId}`;
    const store = platform === 'ios' ? IOS_STORE : ANDROID_STORE;
    const t = setTimeout(() => {
      window.location.href = store;
    }, 1500);
    window.location.href = deepLink;
    // If the app opens, the page is backgrounded and the timeout is effectively cancelled by the OS.
    window.addEventListener('pagehide', () => clearTimeout(t), { once: true });
  }

  if (platform === 'desktop') {
    return (
      <div>
        <p>Öffne den Link auf deinem Handy oder lade die Sparr-App:</p>
        <a href={IOS_STORE}>App Store</a> · <a href={ANDROID_STORE}>Google Play</a>
      </div>
    );
  }

  return (
    <button onClick={openApp} style={btn}>
      {sparringId ? 'In der App öffnen' : 'Sparr-App holen'}
    </button>
  );
}

const btn = { background: '#4A90D9', color: '#fff', border: 0, borderRadius: 14, padding: '14px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer' } as const;

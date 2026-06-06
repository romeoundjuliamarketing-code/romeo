import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
}

// Renders Cloudflare Turnstile inside a WebView and posts the token back to RN.
export default function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}</style>
</head><body>
<div class="cf-turnstile" data-sitekey="${SITE_KEY}"
     data-callback="onTok" data-theme="light"></div>
<script>
function onTok(t){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(t); } }
</script>
</body></html>`,
    [],
  );

  const handleMessage = (e: WebViewMessageEvent) => {
    const token = e.nativeEvent.data;
    if (token.length > 0) onToken(token);
  };

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://send.sparrshop.de' }}
        onMessage={handleMessage}
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 72, marginBottom: 16 },
  webview: { backgroundColor: 'transparent', flex: 1 },
});

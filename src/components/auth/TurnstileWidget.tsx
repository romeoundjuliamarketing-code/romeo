import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

// Renders Cloudflare Turnstile inside a WebView and posts the token back to RN.
export default function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}</style>
</head><body>
<div class="cf-turnstile" data-sitekey="${SITE_KEY}"
     data-callback="onTok" data-error-callback="onErr" data-expired-callback="onErr" data-theme="light"></div>
<script>
var got=false;
function onTok(t){ got=true; if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(t); } }
function onErr(){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage('__error__'); } }
setTimeout(function(){ if(!got && window.ReactNativeWebView){ window.ReactNativeWebView.postMessage('__timeout__'); } }, 15000);
</script>
</body></html>`,
    [],
  );

  const handleMessage = (e: WebViewMessageEvent) => {
    const token = e.nativeEvent.data;
    if (token === '__error__' || token === '__timeout__') {
      onError?.();
      return;
    }
    if (token.length > 0) onToken(token);
  };

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://send.sparrshop.de' }}
        onMessage={handleMessage}
        onError={() => onError?.()}
        onHttpError={() => onError?.()}
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

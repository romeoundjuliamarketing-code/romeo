import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

// Turnstile startet unsichtbar (72px); eskaliert es zur interaktiven Challenge,
// meldet es per ResizeObserver seine echte Höhe. Deckel großzügig, damit die
// Challenge nicht abgeschnitten wird.
const MIN_HEIGHT = 72;
const MAX_HEIGHT = 504;

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

// Strukturierte Nachrichten aus der WebView zurück nach RN.
type TurnstileMessage =
  | { type: 'token'; token: string }
  | { type: 'error' }
  | { type: 'timeout' }
  | { type: 'resize'; height: number };

// Renders Cloudflare Turnstile inside a WebView and posts the token back to RN.
export default function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const [height, setHeight] = useState<number>(MIN_HEIGHT);

  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}</style>
</head><body>
<div class="cf-turnstile" data-sitekey="${SITE_KEY}"
     data-callback="onTok" data-error-callback="onErr" data-expired-callback="onErr" data-theme="light"></div>
<script>
function post(o){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); } }
var got=false;
function onTok(t){ got=true; post({ type:'token', token:t }); }
function onErr(){ post({ type:'error' }); }
setTimeout(function(){ if(!got){ post({ type:'timeout' }); } }, 15000);
var el=document.querySelector('.cf-turnstile');
if(window.ResizeObserver && el){
  var ro=new ResizeObserver(function(entries){
    for(var i=0;i<entries.length;i++){
      var h=Math.ceil(entries[i].contentRect.height);
      if(h>0){ post({ type:'resize', height:h }); }
    }
  });
  ro.observe(el);
}
</script>
</body></html>`,
    [],
  );

  const handleMessage = (e: WebViewMessageEvent) => {
    let msg: TurnstileMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data) as TurnstileMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case 'token':
        if (msg.token.length > 0) onToken(msg.token);
        break;
      case 'error':
      case 'timeout':
        onError?.();
        break;
      case 'resize':
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, msg.height)));
        break;
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://send.sparrshop.de' }}
        onMessage={handleMessage}
        onError={() => onError?.()}
        onHttpError={() => onError?.()}
        scrollEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        androidLayerType="hardware"
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  webview: { backgroundColor: 'transparent', flex: 1 },
});

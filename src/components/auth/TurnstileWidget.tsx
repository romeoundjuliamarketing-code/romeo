import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
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
  /** Official Turnstile size option; 'flexible' spans the available width. Default 'normal'. */
  size?: 'normal' | 'flexible';
  /** Overrides the outer container (e.g. the default bottom margin). */
  containerStyle?: StyleProp<ViewStyle>;
}

// Strukturierte Nachrichten aus der WebView zurück nach RN.
type TurnstileMessage =
  | { type: 'token'; token: string }
  | { type: 'error'; code: string }
  | { type: 'timeout' }
  | { type: 'resize'; height: number };

// Renders Cloudflare Turnstile inside a WebView and posts the token back to RN.
export default function TurnstileWidget({ onToken, onError, size = 'normal', containerStyle }: TurnstileWidgetProps) {
  const [height, setHeight] = useState<number>(MIN_HEIGHT);

  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}${size === 'flexible' ? '.cf-turnstile{width:100%}' : ''}</style>
</head><body>
<div class="cf-turnstile" data-sitekey="${SITE_KEY}"
     data-callback="onTok" data-error-callback="onErr" data-expired-callback="onErr" data-theme="light" data-size="${size}"></div>
<script>
function post(o){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); } }
var got=false;
var rendered=false;
function onTok(t){ got=true; post({ type:'token', token:t }); }
function onErr(code){ post({ type:'error', code:String(code||'') }); }
// Only a widget that never rendered counts as unavailable. A rendered widget
// may be waiting for the user to tick the interactive checkbox.
setTimeout(function(){ if(!got && !rendered){ post({ type:'timeout' }); } }, 15000);
var el=document.querySelector('.cf-turnstile');
if(window.ResizeObserver && el){
  var ro=new ResizeObserver(function(entries){
    for(var i=0;i<entries.length;i++){
      var h=Math.ceil(entries[i].contentRect.height);
      if(h>0){ rendered=true; post({ type:'resize', height:h }); }
    }
  });
  ro.observe(el);
}
</script>
</body></html>`,
    [size],
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
        if (__DEV__) console.warn('[Turnstile] error', msg.code);
        onError?.();
        break;
      case 'timeout':
        if (__DEV__) console.warn('[Turnstile] timeout: widget never rendered');
        onError?.();
        break;
      case 'resize':
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, msg.height)));
        break;
    }
  };

  return (
    <View style={[styles.container, containerStyle, { height }]}>
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

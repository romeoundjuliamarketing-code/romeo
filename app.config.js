const { withAndroidManifest } = require('@expo/config-plugins');

function withGeoIntentQuery(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    if (!manifest.queries) manifest.queries = [];
    const alreadyAdded = manifest.queries.some((q) =>
      q?.intent?.some((i) => i?.data?.some((d) => d?.['$']?.['android:scheme'] === 'geo'))
    );
    if (!alreadyAdded) {
      manifest.queries.push({
        intent: [{
          action: [{ '$': { 'android:name': 'android.intent.action.VIEW' } }],
          data:   [{ '$': { 'android:scheme': 'geo' } }],
        }],
      });
    }
    return c;
  });
}

module.exports = {
  expo: {
    name: "Sparr",
    slug: "sparr",
    scheme: "sparr",
    version: "1.2.2",
    updates: {
      url: "https://u.expo.dev/9811826e-5835-47ff-9c96-8fb7a14cdab3",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A0A",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.kombat.app",
      requireFullScreen: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Sparr zeigt dir Sparring-Partner in deiner Nähe.",
        NSPhotoLibraryUsageDescription:
          "Sparr verwendet deine Fotos, um Bilder im Sparring-Chat zu senden.",
      },
      entitlements: {
        "com.apple.security.application-groups": ["group.com.kombat.app"],
      },
    },
    android: {
      package: "com.kombat.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    assetBundlePatterns: ["assets/**"],
    plugins: [
      "expo-font",
      "@maplibre/maplibre-react-native",
      withGeoIntentQuery,
      "expo-notifications",
      "expo-secure-store",
      "@react-native-community/datetimepicker",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Sparr zeigt dir Sparring-Partner in deiner Nähe.",
        },
      ],
      [
        "react-native-widget-extension",
        {
          deploymentTarget: "17.0",
          groupIdentifier: "group.com.kombat.app",
        },
      ],
      "@sentry/react-native",
      ["expo-camera", { cameraPermission: "Sparr nutzt die Kamera, um den QR-Code eines Kämpferprofils zu scannen." }],
    ],
    extra: {
      eas: {
        projectId: "9811826e-5835-47ff-9c96-8fb7a14cdab3",
      },
    },
  },
};

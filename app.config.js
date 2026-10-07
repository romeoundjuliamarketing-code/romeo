const { withAndroidManifest } = require('@expo/config-plugins');

// Google Sign-In needs the reversed iOS client ID as URL scheme. The plugin
// throws without it, so it is only added once the ID is configured
// (.env locally, EAS environment variables for cloud builds).
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleSignInPlugin = GOOGLE_IOS_CLIENT_ID
  ? [["@react-native-google-signin/google-signin", {
      iosUrlScheme: `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace('.apps.googleusercontent.com', '')}`,
    }]]
  : [];

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
    version: "1.2.7",
    updates: {
      url: "https://u.expo.dev/9811826e-5835-47ff-9c96-8fb7a14cdab3",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    orientation: "portrait",
    // iOS permission texts per device language (Info.plist strings).
    locales: {
      de: "./locales/de.json",
      en: "./locales/en.json",
    },
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
      associatedDomains: ["applinks:sparrapp.com"],
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleDevelopmentRegion: "de",
        CFBundleLocalizations: ["de", "en"],
        NSLocationWhenInUseUsageDescription:
          "Sparr zeigt dir Sparring-Partner in deiner Nähe.",
        NSPhotoLibraryUsageDescription:
          "Sparr verwendet deine Fotos, um Bilder im Sparring-Chat zu senden.",
      },
    },
    android: {
      package: "com.kombat.app",
      adaptiveIcon: {
        backgroundColor: "#000E26",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: "https", host: "sparrapp.com", pathPrefix: "/s/" }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
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
      "@sentry/react-native",
      ["expo-camera", { cameraPermission: "Sparr nutzt die Kamera, um den QR-Code eines Kämpferprofils zu scannen." }],
      "expo-apple-authentication",
      ...googleSignInPlugin,
    ],
    extra: {
      eas: {
        projectId: "9811826e-5835-47ff-9c96-8fb7a14cdab3",
      },
    },
  },
};

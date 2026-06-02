module.exports = {
  expo: {
    name: "Sparr",
    slug: "sparr",
    scheme: "sparr",
    version: "1.1.1",
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
      "@maplibre/maplibre-react-native",
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
    ],
    extra: {
      eas: {
        projectId: "9811826e-5835-47ff-9c96-8fb7a14cdab3",
      },
    },
  },
};

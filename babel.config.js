module.exports = function (api) {
  const isTest = api.env('test');

  if (isTest) {
    // Jest environment: use lightweight TypeScript + CommonJS transform
    return {
      presets: ['@babel/preset-typescript'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    };
  }

  // Expo / Metro bundler: full preset handles JSX, TypeScript, Flow, and RN internals
  // react-native-worklets/plugin must be last — required for reanimated v4 worklet transform
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};

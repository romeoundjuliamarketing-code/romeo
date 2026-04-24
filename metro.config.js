const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude the supabase/functions directory — those are Deno files, not React Native
config.resolver.blockList = [
  /supabase\/functions\/.*/,
];

module.exports = config;

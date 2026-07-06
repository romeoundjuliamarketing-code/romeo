import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is its own standalone project (own package.json/lockfile) nested inside
  // the React Native app's repo, which also has a lockfile at the repo root.
  // Pin the workspace root here so Turbopack doesn't have to guess.
  turbopack: {
    root: __dirname,
  },
  // Apple requires the (extension-less) apple-app-site-association file to be
  // served as application/json; Vercel otherwise defaults it to octet-stream.
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;

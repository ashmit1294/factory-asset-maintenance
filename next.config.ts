import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  poweredByHeader: false,

  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  turbopack: {},

  serverExternalPackages: ['mongoose'],
};

export default nextConfig;
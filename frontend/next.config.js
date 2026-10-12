const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/login/auth/callback',
        destination: '/auth/callback',
      },
    ];
  },
};

module.exports = nextConfig;

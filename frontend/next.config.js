/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.pravatar.cc', 'avatars.githubusercontent.com'],
  },
  output: 'standalone',
};

module.exports = nextConfig;

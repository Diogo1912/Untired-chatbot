import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs', 'mammoth', 'node:sqlite'],
};

export default nextConfig;

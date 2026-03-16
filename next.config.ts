import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs', 'mammoth', 'better-sqlite3'],
};

export default nextConfig;

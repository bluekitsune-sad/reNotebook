/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@synced-notepad/shared', '@synced-notepad/sync-core', '@synced-notepad/validation'],
};

export default nextConfig;

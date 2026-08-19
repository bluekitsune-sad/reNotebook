/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@synced-notepad/shared', '@synced-notepad/sync-core', '@synced-notepad/validation'],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ['sharp', '@prisma/client', '@pump-fun/pump-sdk', 'twitter-api-v2'] },
  poweredByHeader: false,
};
export default nextConfig;

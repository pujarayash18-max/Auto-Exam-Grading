/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    staticPageGenerationTimeout: 300,
    async redirects() {
      return [
        {
          source: '/login',
          destination: '/auth/login',
          permanent: true,
        },
      ]
    },
    async rewrites() {
      const backendUrl = process.env.INTERNAL_BACKEND_URL || (process.env.WATCHPACK_POLLING ? 'http://backend:8000' : 'http://127.0.0.1:8000');
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    },
};

export default nextConfig;

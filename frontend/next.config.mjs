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
};

export default nextConfig;

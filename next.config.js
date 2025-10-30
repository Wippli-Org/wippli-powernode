/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for Docker
  env: {
    POWERNODE_STORAGE_CONNECTION: process.env.POWERNODE_STORAGE_CONNECTION || '',
    AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT || '',
  },
  async rewrites() {
    return [
      {
        source: '/:token(pn_exec_[a-zA-Z0-9]+)',
        destination: '/monitor/:token',
      },
    ];
  },
};

module.exports = nextConfig;

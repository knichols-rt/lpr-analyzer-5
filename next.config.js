/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['bullmq', 'ioredis', 'pg']
}

module.exports = nextConfig
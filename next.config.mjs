/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Re-enable for proper containerized deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

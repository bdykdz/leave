/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Temporarily disabled to debug routing issues
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    domains: ['scbqioxxfyoghyeawhfz.supabase.co'],
  },
};

export default nextConfig;

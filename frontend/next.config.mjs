/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
    ],
  },
  webpack: (config) => {
    // face-api.js needs canvas — ignore it in browser builds
    config.resolve.alias["canvas"] = false;
    return config;
  },
};

export default nextConfig;

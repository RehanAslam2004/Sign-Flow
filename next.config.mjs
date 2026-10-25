/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    // Treat onnxruntime-web as external to prevent Webpack/Terser parse errors on worker ESM
    config.externals = [...(config.externals || []), 'onnxruntime-web'];
    return config;
  },
};

export default nextConfig;

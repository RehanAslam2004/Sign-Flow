/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    // Treat onnxruntime-web as external to prevent Webpack/Terser parse errors on worker ESM
    config.externals = [...(config.externals || []), 'onnxruntime-web'];
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob: https:; script-src 'self' 'unsafe-eval' 'unsafe-inline' wasm-unsafe-eval https: blob:; worker-src 'self' blob:; connect-src 'self' https: blob: data: ws: wss:; img-src 'self' data: blob: https:; media-src 'self' blob: mediastream:; style-src 'self' 'unsafe-inline' https:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

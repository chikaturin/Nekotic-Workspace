import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true, // BẮT BUỘC: để Next.js export dạng /folder/index.html thay vì /folder.html
  basePath: "/Nekotic-Workspace",
  images: {
    unoptimized: true, // BẮT BUỘC: GitHub Pages không chạy được Node.js Image Optimizer
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;

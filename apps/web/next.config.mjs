/** @type {import('next').NextConfig} */
const nextConfig = {
  // @beacon/core ships built ESM in dist/, but transpiling keeps it robust across Next versions.
  transpilePackages: ["@beacon/core"],
  reactStrictMode: true,
};

export default nextConfig;

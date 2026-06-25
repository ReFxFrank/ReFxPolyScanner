/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module; keep it out of the bundle so route
  // handlers `require()` it at runtime instead of webpack trying to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;

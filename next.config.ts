import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Without this, a stray lockfile in a parent directory can make Turbopack
    // infer a workspace root above the project.
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;

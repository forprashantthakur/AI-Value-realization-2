import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "exceljs"],
  // The Rust-free Prisma client loads query_compiler_bg.wasm at runtime; file tracing does not
  // detect it, so ship the generated client folder with every server function (Vercel).
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/client/**/*"],
  },
};

export default nextConfig;

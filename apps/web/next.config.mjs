import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// The repo root: curriculum.json lives there and is imported by content/curriculum.js.
const repoRoot = path.resolve(here, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot
};

export default nextConfig;

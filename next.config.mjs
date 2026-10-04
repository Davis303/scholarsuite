/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
    // The similarity process route loads pdf.js at runtime. Make sure the
    // worker script and the font/cmap data files ship inside the
    // serverless bundle even though they are loaded dynamically.
    outputFileTracingIncludes: {
      "/api/reviews/[id]/process": [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.js",
        "./node_modules/pdfjs-dist/standard_fonts/**/*",
        "./node_modules/pdfjs-dist/cmaps/**/*",
      ],
    },
  },
};

export default nextConfig;

const { build } = require("esbuild");
const { readFileSync, writeFileSync } = require("fs");
const { resolve } = require("path");

async function buildHandlers() {
  console.log("🚀 Building handlers...");

  try {
    const result = await build({
      entryPoints: ["src/handlers/index.ts"],
      bundle: true,
      minify: true,
      sourcemap: false,
      target: "node18",
      platform: "node",
      format: "cjs",
      outfile: "dist/handlers.js",
      external: [
        // Add external dependencies here if needed
      ],
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      // Tree shaking optimizations
      treeShaking: true,
      // Optimize for size
      keepNames: false,
      // Bundle analysis
      metafile: true,
      write: true,
    });

    // Write bundle analysis
    writeFileSync(
      "dist/handlers-meta.json",
      JSON.stringify(result.metafile, null, 2)
    );

    // Calculate bundle size
    const bundleSize = readFileSync("dist/handlers.js").length;
    const bundleSizeKB = (bundleSize / 1024).toFixed(2);
    const bundleSizeMB = (bundleSize / (1024 * 1024)).toFixed(2);

    console.log("✅ Handlers build completed successfully!");
    console.log(`📦 Bundle size: ${bundleSizeKB} KB (${bundleSizeMB} MB)`);

    if (bundleSize > 50 * 1024 * 1024) {
      console.warn(
        "⚠️  Warning: Bundle size exceeds 50MB serverless limit for direct upload"
      );
      console.log(
        "💡 Consider using external storage or optimizing dependencies"
      );
    }

    // Suggest optimizations for larger bundles
    if (bundleSize > 10 * 1024 * 1024) {
      console.log("💡 Bundle optimization suggestions:");
      console.log("   - Review dependencies in handlers-meta.json");
      console.log("   - Consider external dependencies");
      console.log("   - Use layers or external modules for large dependencies");
    }
  } catch (error) {
    console.error("❌ Handlers build failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  buildHandlers();
}

module.exports = { buildHandlers };

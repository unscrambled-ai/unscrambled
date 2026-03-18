import * as esbuild from "esbuild";

export async function execBuild() {
  console.info("Building");

  const result = await esbuild.build({
    entryPoints: ["./index.js"],
    entryNames: "[dir]/index",
    bundle: true,
    minify: true,
    sourcemap: true,
    platform: "node",
    target: "node16.17",
    outdir: "build",
  });

  console.debug("Build result", result);

  for (const warning of result.warnings) {
    console.warn(warning);
  }

  for (const error of result.errors) {
    console.error(error);
  }

  if (result.errors.length === 0) {
    console.info("Successful build");
  } else {
    throw new Error("Build failed");
  }
}

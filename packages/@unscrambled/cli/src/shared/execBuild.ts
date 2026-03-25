import * as esbuild from "esbuild";

export interface ExecBuildOptions {
  quiet?: boolean;
}

export async function execBuild(options: ExecBuildOptions = {}) {
  if (!options.quiet) {
    console.info("Building");
  }

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

  if (!options.quiet) {
    console.debug("Build result", result);
  }

  if (!options.quiet) {
    for (const warning of result.warnings) {
      console.warn(warning);
    }
  }

  for (const error of result.errors) {
    console.error(error);
  }

  if (result.errors.length === 0) {
    if (!options.quiet) {
      console.info("Successful build");
    }
  } else {
    throw new Error("Build failed");
  }

  return result;
}

import execa from "execa";
import { program } from "commander";

export default async function installPackages(repo: string) {
  console.log(`Installing packages to ${repo}`);
  try {
    const p = execa("npm", ["install"], {
      cwd: repo,
    });

    if (p.stdout) {
      p.stdout.pipe(process.stdout);
    }

    await p;
  } catch (error) {
    console.log(error);
    program.error("Error installing packages");
  }
}

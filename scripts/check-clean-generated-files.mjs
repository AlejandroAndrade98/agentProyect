import { execFileSync } from "node:child_process";

const generatedPaths = [
  "apps/web/tsconfig.tsbuildinfo",
  "apps/web/.turbo/turbo-build.log",
  "apps/api/.turbo/turbo-build.log",
  "apps/worker/.turbo/turbo-build.log",
  "apps/web/.next",
  ".next",
];

function gitStatus(paths) {
  return execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", ...paths],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}

const status = gitStatus(generatedPaths);

if (status) {
  console.error("Generated build artifacts have pending git changes:");
  console.error(status);
  console.error("");
  console.error(
    "Restore tracked generated files or remove accidental untracked build output before continuing.",
  );
  process.exit(1);
}

console.log("Generated artifact guard passed.");

import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["--filter", "@workspace/db", "run", "push"]);
run("pnpm", ["--filter", "@workspace/api-server", "run", "repair-db"]);
run("pnpm", ["--filter", "@workspace/api-server", "run", "create-admin"]);

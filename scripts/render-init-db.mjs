import { spawnSync } from "node:child_process";

function run(command, args, { required = true } = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    if (!required) {
      console.warn(
        `[render:init-db] Optional step failed and will be skipped: ${command} ${args.join(" ")}`,
      );
      return false;
    }

    process.exit(result.status ?? 1);
  }

  return true;
}

run("pnpm", ["--filter", "@workspace/db", "run", "push"], { required: false });
run("pnpm", ["--filter", "@workspace/api-server", "run", "repair-db"]);
run("pnpm", ["--filter", "@workspace/api-server", "run", "create-admin"]);

// Run after cloning and by t3.json in each new worktree: install, link .env.local and .repos from the
// main checkout, and check out Effect's source at the installed version (agents read its LLMS.md).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

const run = (command: string, ...args: string[]) =>
  execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

run("bun", "install", "--frozen-lockfile");

const main = dirname(run("git", "rev-parse", "--path-format=absolute", "--git-common-dir").trim());
if (main !== process.cwd()) {
  for (const name of [".env.local", ".repos"]) {
    if (!existsSync(name) && existsSync(join(main, name))) symlinkSync(join(main, name), name);
  }
}

const { version } = JSON.parse(readFileSync("node_modules/effect/package.json", "utf8"));
const tag = `effect@${version}`;
const effect = join(main, ".repos/effect");
if (!existsSync(effect)) {
  mkdirSync(dirname(effect), { recursive: true });
  run(
    "git",
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--branch",
    tag,
    "https://github.com/Effect-TS/effect",
    effect,
  );
} else if (!run("git", "-C", effect, "tag", "--points-at", "HEAD").split("\n").includes(tag)) {
  run("git", "-C", effect, "fetch", "--quiet", "--depth", "1", "origin", "tag", tag);
  run("git", "-C", effect, "checkout", "--quiet", tag);
}

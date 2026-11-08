import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npmCommand, ["run", "dev:api"], { stdio: "inherit", env: process.env }),
  spawn(npmCommand, ["run", "dev:frontend"], { stdio: "inherit", env: process.env }),
];

const shutdown = (signal) => {
  for (const child of children) child.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (code && code !== 0) process.exitCode = code;
    if (signal) process.exitCode = 1;
  });
}

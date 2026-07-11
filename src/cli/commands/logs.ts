import { Command } from "commander";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { daemonLogDir, daemonLogFilePath } from "../daemon/config.js";

export function listLogFiles(dir = daemonLogDir()): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".log"))
    .map((name) => join(dir, name))
    .sort((a, b) => {
      try {
        return statSync(b).mtimeMs - statSync(a).mtimeMs;
      } catch {
        return 0;
      }
    });
}

export function readLastLines(filePath: string, lineCount: number): string[] {
  if (lineCount <= 0) return [];
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, "utf-8");
  if (!text) return [];
  const lines = text.replace(/\n$/, "").split("\n");
  return lines.slice(-lineCount);
}

export function logsCommand(): Command {
  return new Command("logs")
    .description("Show daemon log path and recent log lines")
    .option("--lines <n>", "Number of recent lines to print", "50")
    .option("--path-only", "Print only the current log file path")
    .option("--list", "List available log files")
    .action((opts) => {
      const dir = daemonLogDir();
      const current = daemonLogFilePath();

      if (opts.pathOnly) {
        console.log(current);
        return;
      }

      if (opts.list) {
        const files = listLogFiles(dir);
        if (files.length === 0) {
          console.log(`No log files in ${dir}`);
          return;
        }
        for (const f of files) console.log(f);
        return;
      }

      console.log(`Log directory: ${dir}`);
      console.log(`Current log:   ${current}`);

      if (!existsSync(current)) {
        console.log("\nNo log file yet. Start the daemon to create logs:");
        console.log("  phneakngar daemon start");
        return;
      }

      const n = Math.max(1, Number.parseInt(String(opts.lines), 10) || 50);
      const lines = readLastLines(current, n);
      console.log(`\n--- last ${lines.length} line(s) ---\n`);
      for (const line of lines) console.log(line);
    });
}

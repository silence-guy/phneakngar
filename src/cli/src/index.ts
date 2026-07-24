#!/usr/bin/env node
import { Command } from "commander";
import { registerCommand } from "../commands/register.js";
import { loginCommand } from "../commands/login.js";
import { statusCommand } from "../commands/status.js";
import { chhlatCommand } from "../commands/chhlat.js";
import { configCommand } from "../commands/config.js";
import { emailCommand } from "../commands/email.js";
import { calendarCommand } from "../commands/calendar.js";
import { issueCommand } from "../commands/issue.js";
import { agentCommand } from "../commands/agent.js";
import { versionCommand } from "../commands/version.js";
import { updateCommand } from "../commands/update.js";
import { syncCommand } from "../commands/sync.js";
import { workspaceCommand } from "../commands/workspace.js";
import { doctorCommand } from "../commands/doctor.js";
import { logsCommand } from "../commands/logs.js";
import { initCommand } from "../commands/init.js";
import { skillCommand } from "../commands/skill.js";
import { webCommand } from "../commands/web.js";
import { grantAccessCommand } from "../commands/grant-access.js";

const program = new Command();

program
  .name("phneakngar")
  .description("ភ្នាក់ងារ CLI — local agent runtime for client machines")
  .option("--server <url>", "Server URL")
  .option("--profile <name>", "Profile name");

program.addCommand(initCommand());
program.addCommand(doctorCommand());
program.addCommand(grantAccessCommand());
program.addCommand(webCommand());
program.addCommand(registerCommand());
program.addCommand(loginCommand());
program.addCommand(statusCommand());
program.addCommand(chhlatCommand());
program.addCommand(logsCommand());
program.addCommand(emailCommand());
program.addCommand(calendarCommand());
program.addCommand(issueCommand());
program.addCommand(agentCommand());
program.addCommand(skillCommand());
program.addCommand(configCommand());
program.addCommand(versionCommand());
program.addCommand(updateCommand());
program.addCommand(syncCommand());
program.addCommand(workspaceCommand());

program.parse();

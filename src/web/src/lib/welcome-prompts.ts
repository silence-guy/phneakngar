/**
 * Shared language rules for agent welcome email/chat tasks.
 * User-facing greetings must always be Khmer, never "match owner language".
 */

/** Exact subjects the model must use (avoids garbled "AI Studio ***" titles). */
export const WELCOME_EMAIL_SUBJECT_STUDIO = "សូមស្វាគមន៍ពី AI Studio របស់អ្នក";
export const WELCOME_EMAIL_SUBJECT_AGENT = "សូមស្វាគមន៍ពីភ្នាក់ងារ AI របស់អ្នក";
export const WELCOME_EMAIL_SUBJECT_WHITELIST = "សូមស្វាគមន៍ — ទំនាក់ទំនងថ្មី";

export const WELCOME_USER_FACING_KHMER_RULE =
  "CRITICAL LANGUAGE RULE: Write ALL user-facing content (greeting, chat message, and email body) entirely in natural Khmer (km-KH). " +
  "Do NOT match the owner's name or email language. Even if the owner uses English, still write in Khmer. " +
  "Keep technical tokens (email addresses, CLI commands, file paths) in English. " +
  "Never use asterisks (***) or placeholder characters in the subject or body.";

function emailSubjectRule(exactSubject: string): string {
  return (
    `EMAIL SUBJECT (MANDATORY): Use this exact subject line with no changes, no asterisks, no English-only rewrite: ` +
    `"${exactSubject}"`
  );
}

export function buildStudioWelcomeEmailPrompt(opts: {
  ownerEmail: string;
  leaderName: string;
  teammatesList?: string;
}): string {
  const subjectRule = emailSubjectRule(WELCOME_EMAIL_SUBJECT_STUDIO);
  if (!opts.teammatesList) {
    return (
      `You have just been created by your owner (${opts.ownerEmail}). ` +
      `Send them a welcome email introducing yourself as "${opts.leaderName}". ` +
      `Include: 1) Warm introduction — your name, email address, and how you help. ` +
      `2) Brief introduction to the ភ្នាក់ងារ platform. ` +
      `3) That they can chat with you or email you anytime. ` +
      `Be warm, professional, and concise. ${subjectRule} ${WELCOME_USER_FACING_KHMER_RULE}`
    );
  }
  return (
    `You have just been created as the lead of a new AI studio by your owner (${opts.ownerEmail}). ` +
    `Your teammates are:\n${opts.teammatesList}\n\n` +
    `Send a welcome email introducing yourself and all teammates. Include: ` +
    `1) Your name and email. 2) Each teammate's name, email, and role. ` +
    `3) How the team works — you coordinate and delegate. ` +
    `4) That they can email you to assign work. ` +
    `Be warm, professional, and concise. ${subjectRule} ${WELCOME_USER_FACING_KHMER_RULE}`
  );
}

export function buildStudioWelcomeChatPrompt(opts: {
  ownerEmail: string;
  leaderName: string;
  teammatesList?: string;
}): string {
  if (!opts.teammatesList) {
    return (
      `You have just been created by your owner (${opts.ownerEmail}). ` +
      `Introduce yourself as "${opts.leaderName}" in this chat. ` +
      `1) Warm introduction — your name and how you help. ` +
      `2) Brief introduction to the ភ្នាក់ងារ platform. ` +
      `3) That they can chat or email you anytime. ` +
      `Be warm, professional, and concise. ${WELCOME_USER_FACING_KHMER_RULE}`
    );
  }
  return (
    `You have just been created as the lead of a new AI studio by your owner (${opts.ownerEmail}). ` +
    `Your teammates are:\n${opts.teammatesList}\n\n` +
    `Introduce yourself and all teammates in this chat. Include: ` +
    `1) Your name. 2) Each teammate's name and role. ` +
    `3) How the team works — you coordinate and delegate. ` +
    `4) That they can chat with you to assign work. ` +
    `Be warm, professional, and concise. ${WELCOME_USER_FACING_KHMER_RULE}`
  );
}

export function buildAgentWelcomeEmailPrompt(opts: {
  ownerEmail: string;
  agentName: string;
}): string {
  return (
    `You have just been created by your owner (${opts.ownerEmail}). ` +
    `Send them a welcome email introducing yourself as "${opts.agentName}". ` +
    `In the email: 1) Warm introduction — your name, email, and how you help. ` +
    `2) Brief introduction to the ភ្នាក់ងារ platform — agents can handle emails, schedule tasks, and work autonomously. ` +
    `3) That they can chat with you or email you anytime. ` +
    `Be warm, professional, and concise. ` +
    `${emailSubjectRule(WELCOME_EMAIL_SUBJECT_AGENT)} ${WELCOME_USER_FACING_KHMER_RULE}`
  );
}

export function buildWhitelistWelcomeEmailPrompt(opts: {
  ownerEmail: string;
  agentName: string;
  contactEmail: string;
}): string {
  return (
    `Your owner (${opts.ownerEmail}) added a new contact to your whitelist: ${opts.contactEmail}. ` +
    `Compose and send them a welcome email introducing yourself as "${opts.agentName}". ` +
    `Be warm and professional. Tell them how to reach you and briefly how you can help. ` +
    `${emailSubjectRule(WELCOME_EMAIL_SUBJECT_WHITELIST)} ${WELCOME_USER_FACING_KHMER_RULE}`
  );
}

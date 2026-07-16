/**
 * Pure helpers for multi-party DM membership UI.
 * Reuses channel member display resolution by mapping conversation_member rows.
 */

import type { ChannelMemberRow } from "@/lib/channel-members-display";

export type ConversationMemberApiRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  member_type: string;
  member_id: string;
  created_at?: string;
};

/**
 * Map conversation_member API rows into the channel-member display shape
 * so resolveChannelMembers / agentsAvailableToAdd stay single-sourced.
 */
export function conversationMembersToDisplayRows(
  items: ConversationMemberApiRow[],
): ChannelMemberRow[] {
  return items.map((item) => ({
    id: item.id,
    workspace_id: item.workspace_id,
    channel_id: item.conversation_id,
    member_type: item.member_type,
    member_id: item.member_id,
    created_at: item.created_at,
  }));
}

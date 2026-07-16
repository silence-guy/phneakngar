import type { Channel } from "@phneakngar/shared";
import { apiFetch, wsQuery } from "./client";

export const listChannels = (workspaceId: string) =>
  apiFetch<Channel[]>(`/api/channels${wsQuery(workspaceId)}`);

export const createChannelApi = (workspaceId: string, name: string) =>
  apiFetch<Channel>(`/api/channels${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const renameChannelApi = (id: string, workspaceId: string, name: string) =>
  apiFetch<Channel>(`/api/channels/${id}${wsQuery(workspaceId)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });

export const deleteChannelApi = (id: string, workspaceId: string) =>
  apiFetch<{ ok: boolean }>(`/api/channels/${id}${wsQuery(workspaceId)}`, {
    method: "DELETE",
  });

export const reorderChannelsApi = (workspaceId: string, orderedChannelIds: string[]) =>
  apiFetch<void>(`/api/channels/reorder${wsQuery(workspaceId)}`, {
    method: "PUT",
    body: JSON.stringify({ ordered_channel_ids: orderedChannelIds }),
  });

export type ChannelMemberItem = {
  id: string;
  workspace_id: string;
  channel_id: string;
  member_type: "user" | "agent" | string;
  member_id: string;
  created_at: string;
};

export const listChannelMembers = (channelId: string, workspaceId: string) =>
  apiFetch<{ items: ChannelMemberItem[] }>(
    `/api/channels/${channelId}/members${wsQuery(workspaceId)}`,
  );

export const addChannelMember = (
  channelId: string,
  workspaceId: string,
  body: { member_type: "user" | "agent"; member_id: string },
) =>
  apiFetch<{ member: ChannelMemberItem }>(
    `/api/channels/${channelId}/members${wsQuery(workspaceId)}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

export const removeChannelMember = (
  channelId: string,
  workspaceId: string,
  memberType: "user" | "agent",
  memberId: string,
) =>
  apiFetch<{ ok: boolean; member: ChannelMemberItem }>(
    `/api/channels/${channelId}/members${wsQuery(workspaceId, {
      member_type: memberType,
      member_id: memberId,
    })}`,
    { method: "DELETE" },
  );

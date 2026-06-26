import type { User } from "@phneakngar/shared";
import { apiFetch } from "./client";

export const getMe = () => apiFetch<User>("/api/me");

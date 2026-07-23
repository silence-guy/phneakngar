/**
 * RuntimeNotificationState — inbox-notice de-duplication and batching.
 *
 * When the chhlat injects "you have N unread messages" notices into a running
 * agent, it must avoid re-sending the same notice set within a session (which
 * would spam the agent). This tracks a per-(session) fingerprint of the last
 * notice written, which message identities have already been contributed, and a
 * one-shot debounce timer for batching bursts.
 *
 * Identity priority: positive `seq` → `message_id` → `id`. Fingerprint = sorted,
 * comma-joined identities. Empty fingerprint ⇒ never a duplicate (fail toward
 * sending).
 */
export function inboxNoticeMessageIdentity(message) {
    const seq = typeof message.seq === "number" && Number.isFinite(message.seq) && message.seq > 0
        ? Math.floor(message.seq)
        : null;
    if (seq !== null)
        return `s:${seq}`;
    const id = typeof message.message_id === "string" && message.message_id.length > 0
        ? message.message_id
        : typeof message.id === "string" && message.id.length > 0
            ? message.id
            : "";
    return id.length > 0 ? `m:${id}` : "";
}
export function computeInboxNoticeFingerprint(messages) {
    const keys = [];
    for (const m of messages) {
        const key = inboxNoticeMessageIdentity(m);
        if (key.length > 0)
            keys.push(key);
    }
    if (keys.length === 0)
        return "";
    keys.sort();
    return keys.join(",");
}
export class RuntimeNotificationState {
    pendingCountValue = 0;
    timerValue = null;
    lastNoticeFingerprint = null;
    lastNoticeSessionId = null;
    lastEncodeFailedFingerprint = null;
    lastEncodeFailedSessionId = null;
    contributedIdentities = new Set();
    contributionSessionId = null;
    get pendingCount() {
        return this.pendingCountValue;
    }
    isDuplicateNotice(fingerprint, sessionId) {
        if (fingerprint.length === 0)
            return false;
        return this.lastNoticeFingerprint === fingerprint && this.lastNoticeSessionId === sessionId;
    }
    recordNoticeWritten(fingerprint, sessionId, messages = []) {
        this.lastNoticeFingerprint = fingerprint;
        this.lastNoticeSessionId = sessionId;
        this.lastEncodeFailedFingerprint = null;
        this.lastEncodeFailedSessionId = null;
        this.ensureContributionSession(sessionId);
        for (const message of messages) {
            const identity = inboxNoticeMessageIdentity(message);
            if (identity.length > 0)
                this.contributedIdentities.add(identity);
        }
    }
    recordNoticeEncodeFailed(fingerprint, sessionId) {
        if (fingerprint.length === 0)
            return;
        this.lastEncodeFailedFingerprint = fingerprint;
        this.lastEncodeFailedSessionId = sessionId;
    }
    isDuplicateEncodeFailedNotice(fingerprint, sessionId) {
        if (fingerprint.length === 0)
            return false;
        return this.lastEncodeFailedFingerprint === fingerprint && this.lastEncodeFailedSessionId === sessionId;
    }
    filterUncontributedMessages(messages, sessionId) {
        if (this.contributionSessionId !== sessionId)
            return messages;
        return messages.filter((m) => {
            const identity = inboxNoticeMessageIdentity(m);
            return identity.length === 0 || !this.contributedIdentities.has(identity);
        });
    }
    add(count = 1) {
        this.pendingCountValue += count;
    }
    schedule(callback, delayMs) {
        if (this.timerValue)
            return false;
        this.timerValue = setTimeout(() => {
            this.timerValue = null;
            callback();
        }, delayMs);
        this.timerValue.unref?.();
        return true;
    }
    takePendingAndClearTimer() {
        const count = this.pendingCountValue;
        this.pendingCountValue = 0;
        if (this.timerValue) {
            clearTimeout(this.timerValue);
            this.timerValue = null;
        }
        return count;
    }
    ensureContributionSession(sessionId) {
        if (this.contributionSessionId !== sessionId) {
            this.contributionSessionId = sessionId;
            this.contributedIdentities = new Set();
        }
    }
}

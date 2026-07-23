/**
 * RuntimeTurnState — the fine-grained steering gate.
 *
 * For `busyDeliveryMode: "gated"` runtimes (Claude), the chhlat may NOT inject a
 * busy message at an arbitrary instant: a raw stdin write mid-stream can collide
 * with an active signed thinking block. This tiny state machine tracks whether
 * we're currently at a safe point.
 *
 *   turn starts        → gate OPEN  (canSteerBusy = true)
 *   tool boundary hit  → gate SHUT  (hold writes)
 *   progress observed  → gate OPEN
 *   turn completes     → idle, gate OPEN
 *
 * `canSteerBusy` is the single question the delivery path asks before writing.
 */
export class RuntimeTurnState {
    currentTurnId = null;
    steeringGateActive = false;
    get isInTurn() {
        return this.currentTurnId !== null;
    }
    get turnId() {
        return this.currentTurnId;
    }
    get canSteerBusy() {
        return Boolean(this.currentTurnId && !this.steeringGateActive);
    }
    markTurnStarted(turnId) {
        if (turnId !== undefined && turnId !== null) {
            this.currentTurnId = turnId;
        }
        this.steeringGateActive = false;
    }
    adoptTurnId(turnId) {
        this.currentTurnId = turnId;
    }
    markToolBoundary() {
        this.steeringGateActive = true;
    }
    markProgress() {
        this.steeringGateActive = false;
    }
    markTurnCompleted() {
        this.currentTurnId = null;
        this.steeringGateActive = false;
    }
    reset() {
        this.currentTurnId = null;
        this.steeringGateActive = false;
    }
}

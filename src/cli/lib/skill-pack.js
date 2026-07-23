function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Normalize unknown JSON into a skill pack; throws on invalid shape. */
export function parseSkillPack(raw) {
    if (!isRecord(raw))
        throw new Error("skill pack must be an object");
    const skillsRaw = raw.skills;
    if (!Array.isArray(skillsRaw))
        throw new Error("skill pack.skills must be an array");
    const skills = [];
    for (const item of skillsRaw) {
        if (!isRecord(item))
            throw new Error("skill pack entry must be an object");
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (!name)
            throw new Error("skill pack entry requires name");
        const description = typeof item.description === "string" ? item.description : "";
        const runtime = typeof item.runtime === "string" ? item.runtime : undefined;
        const isGlobal = typeof item.isGlobal === "boolean" ? item.isGlobal : undefined;
        skills.push({ name, description, ...(runtime ? { runtime } : {}), ...(isGlobal != null ? { isGlobal } : {}) });
    }
    return {
        version: 1,
        skills,
        exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : undefined,
        source: typeof raw.source === "string" ? raw.source : undefined,
    };
}
/**
 * Idempotent merge by skill name (later items overwrite description/runtime for the same name).
 * Order: existing first, then new names appended.
 */
export function mergeSkillsByName(existing, incoming) {
    const byName = new Map();
    for (const skill of existing) {
        byName.set(skill.name, skill);
    }
    for (const skill of incoming) {
        const prev = byName.get(skill.name);
        byName.set(skill.name, prev ? { ...prev, ...skill, name: skill.name } : skill);
    }
    return Array.from(byName.values());
}
export function toSkillPack(skills, opts) {
    return {
        version: 1,
        skills,
        exportedAt: opts?.exportedAt ?? new Date().toISOString(),
        source: opts?.source,
    };
}
export function skillPackToJson(pack) {
    return `${JSON.stringify(pack, null, 2)}\n`;
}

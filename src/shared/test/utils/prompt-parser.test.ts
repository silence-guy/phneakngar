import { describe, it, expect } from "vitest"
import { parsePromptMentions } from "../../src/utils/prompt-parser"

const TEST_DOMAIN = "agents.example"
const bot = (name: string, emailHandle: string | null = null, description = "") => ({
  name,
  emailHandle,
  description,
})
const parse = (prompt: string, agents: ReturnType<typeof bot>[]) =>
  parsePromptMentions(prompt, agents, TEST_DOMAIN)

describe("parsePromptMentions", () => {
  it("enriches a single mention with email", () => {
    const result = parse("Hey @TestBot do this", [bot("TestBot", "testbot")])
    expect(result.enrichedPrompt).toBe("Hey @TestBot (testbot@agents.example) do this")
    expect(result.mentions).toHaveLength(1)
    expect(result.mentions[0]).toEqual({ name: "TestBot", email: "testbot@agents.example", description: "" })
  })

  it("enriches multiple mentions", () => {
    const result = parse("@Alpha and @Beta please coordinate", [
      bot("Alpha", "alpha"),
      bot("Beta", "beta"),
    ])
    expect(result.enrichedPrompt).toBe("@Alpha (alpha@agents.example) and @Beta (beta@agents.example) please coordinate")
    expect(result.mentions).toHaveLength(2)
  })

  it("leaves mention without email handle unchanged", () => {
    const result = parse("Ask @NoEmail about it", [bot("NoEmail")])
    expect(result.enrichedPrompt).toBe("Ask @NoEmail about it")
    expect(result.mentions).toHaveLength(1)
    expect(result.mentions[0].email).toBeNull()
  })

  it("does not match email addresses", () => {
    const result = parse("send to user@example.com", [bot("example", "ex")])
    expect(result.enrichedPrompt).toBe("send to user@example.com")
    expect(result.mentions).toHaveLength(0)
  })

  it("does not match mid-word @ with agent name", () => {
    const result = parse("email@TestBot", [bot("TestBot", "testbot")])
    expect(result.enrichedPrompt).toBe("email@TestBot")
    expect(result.mentions).toHaveLength(0)
  })

  it("does not match unknown agents", () => {
    const result = parse("@UnknownAgent hi", [bot("TestBot", "testbot")])
    expect(result.enrichedPrompt).toBe("@UnknownAgent hi")
    expect(result.mentions).toHaveLength(0)
  })

  it("matches case-insensitively and preserves canonical name", () => {
    const result = parse("hey @testbot", [bot("TestBot", "testbot")])
    expect(result.enrichedPrompt).toBe("hey @TestBot (testbot@agents.example)")
    expect(result.mentions).toHaveLength(1)
  })

  it("prefers longest match (greedy)", () => {
    const result = parse("@SalesBot", [bot("Sales", "sales"), bot("SalesBot", "salesbot")])
    expect(result.enrichedPrompt).toBe("@SalesBot (salesbot@agents.example)")
    expect(result.mentions).toHaveLength(1)
    expect(result.mentions[0].name).toBe("SalesBot")
  })

  it("matches mention at start of string", () => {
    const result = parse("@Bot do this", [bot("Bot", "bot")])
    expect(result.enrichedPrompt).toBe("@Bot (bot@agents.example) do this")
    expect(result.mentions).toHaveLength(1)
  })

  it("matches mention after newline", () => {
    const result = parse("line one\n@Bot do this", [bot("Bot", "bot")])
    expect(result.enrichedPrompt).toBe("line one\n@Bot (bot@agents.example) do this")
    expect(result.mentions).toHaveLength(1)
  })

  it("matches agent name with spaces", () => {
    const result = parse("Hey @Marketing Bot do this", [bot("Marketing Bot", "marketing-bot")])
    expect(result.enrichedPrompt).toBe("Hey @Marketing Bot (marketing-bot@agents.example) do this")
    expect(result.mentions).toHaveLength(1)
  })

  it("does not match without @ prefix", () => {
    const result = parse("Hey Marketing Bot do this", [bot("Marketing Bot", "marketing-bot")])
    expect(result.enrichedPrompt).toBe("Hey Marketing Bot do this")
    expect(result.mentions).toHaveLength(0)
  })

  it("returns unchanged prompt with empty agent list", () => {
    const result = parse("Hey @Bot", [])
    expect(result.enrichedPrompt).toBe("Hey @Bot")
    expect(result.mentions).toHaveLength(0)
  })

  it("enriches duplicate mentions of same agent", () => {
    const result = parse("@Bot do this and @Bot do that", [bot("Bot", "bot")])
    expect(result.enrichedPrompt).toBe("@Bot (bot@agents.example) do this and @Bot (bot@agents.example) do that")
    expect(result.mentions).toHaveLength(2)
  })

  it("handles adjacent mentions: @Bot1@Bot2", () => {
    const result = parse("@Bot1@Bot2", [bot("Bot1", "bot1"), bot("Bot2", "bot2")])
    // @Bot1 matches (followed by @, a non-alphanumeric char)
    // @Bot2 does NOT match (@ preceded by '1', an alphanumeric)
    expect(result.enrichedPrompt).toBe("@Bot1 (bot1@agents.example)@Bot2")
    expect(result.mentions).toHaveLength(1)
    expect(result.mentions[0].name).toBe("Bot1")
  })

  it("matches agent name with special characters (parentheses)", () => {
    const result = parse("Hey @Bot (v2) do this", [bot("Bot (v2)", "bot-v2")])
    expect(result.enrichedPrompt).toBe("Hey @Bot (v2) (bot-v2@agents.example) do this")
    expect(result.mentions).toHaveLength(1)
  })

  it("includes description in mention when present", () => {
    const result = parse("@Helper", [bot("Helper", "helper", "A helpful bot")])
    expect(result.mentions[0].description).toBe("A helpful bot")
  })

  it("handles @ after punctuation (parentheses, quotes)", () => {
    const result = parse('(@Bot) and "@Bot"', [bot("Bot", "bot")])
    expect(result.enrichedPrompt).toBe('(@Bot (bot@agents.example)) and "@Bot (bot@agents.example)"')
    expect(result.mentions).toHaveLength(2)
  })
})

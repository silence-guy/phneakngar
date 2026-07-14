import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const expectedDomain = process.env.NEXT_PUBLIC_PHNEAKNGAR_DOMAIN?.trim().toLowerCase()
if (!expectedDomain) {
  throw new Error("NEXT_PUBLIC_PHNEAKNGAR_DOMAIN is required to verify the browser build")
}

const chunksDirectory = join(process.cwd(), ".next", "static", "chunks")

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listJavaScriptFiles(path)
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : []
  }))
  return nested.flat()
}

const files = await listJavaScriptFiles(chunksDirectory)
let matched = false
for (const file of files) {
  if ((await readFile(file, "utf8")).toLowerCase().includes(expectedDomain)) {
    matched = true
    break
  }
}

if (!matched) {
  throw new Error("Configured email domain was not embedded in generated browser assets")
}

console.log("Verified configured email domain in generated browser assets")

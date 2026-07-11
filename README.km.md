<p align="center">
  <img src="./assets/readme-banner.png" alt="ភ្នាក់ងារ – វេទិកា Open-source សម្រាប់ដំណើរការក្រុមហ៊ុន AI ផ្ទាល់ខ្លួនរបស់អ្នក" width="800" />
</p>

# ភ្នាក់ងារ — មគ្គុទេសក៍ដំឡើង (Installation Guide)

ឯកសារនេះពន្យល់ពីរបៀបដំឡើងគម្រោង **ភ្នាក់ងារ** ទៅក្នុងម៉ាស៊ីនរបស់អ្នក ដើម្បីដំណើរការក្នុងមូលដ្ឋាន (local development)។

> អ្នកប្រើជាភាសាអង់គ្លេស សូមមើល [README.md](README.md)។

## ភ្នាក់ងារ គឺជាអ្វី?

ភ្នាក់ងារ គឺជាវេទិកា open-source ដែលអ្នកអាច self-host ដោយខ្លួនឯង។ វាបំប្លែង AI coding agents ក្នុងមូលដ្ឋានរបស់អ្នកឱ្យក្លាយជាក្រុមការងារ ដែលធ្វើការសហការគ្នា។ Agents នីមួយៗមាន អ៊ីមែល (email), តួនាទី (role), និង runtime ដែលដំណើរការ ២៤ម៉ោង។

---

## ១. តម្រូវការមុនពេលដំឡើង (Prerequisites)

សូមដំឡើងកម្មវិធីខាងក្រោមជាមុនសិន៖

| កម្មវិធី | កំណែ (Version) | គោលបំណង |
|---------|----------------|---------|
| **Node.js** | `20` ឬថ្មីជាង | ដំណើរការ runtime សម្រាប់ web និង workers |
| **pnpm** | `10.33.0` ឬថ្មីជាង | កម្មវិធីគ្រប់គ្រង package (package manager) |
| **Bun** | `1.3` ឬថ្មីជាង | ត្រូវការសម្រាប់ CLI daemon |
| **Cloudflare Wrangler** | ចុងក្រោយ | សម្រាប់ដំណើរការ D1 (SQLite) និង Workers ក្នុងមូលដ្ឋាន |

### ពិនិត្យកំណែ Node.js

```bash
node --version   # គួរបង្ហាញ v20.x.x ឬខ្ពស់ជាង
```

### ដំឡើង pnpm (បើមិនទាន់មាន)

```bash
npm install -g pnpm@10.33.0
```

### ដំឡើង Bun (បើមិនទាន់មាន)

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

> បន្ថែម `export PATH="$HOME/.bun/bin:$PATH"` ទៅក្នុង `~/.zshrc` ឬ `~/.bashrc` ដើម្បីឱ្យ Bun ដំណើរការគ្រប់ពេល។

---

## ២. ទាញយកប្រភពកូដ (Clone the Repository)

```bash
git clone https://github.com/silence-guy/phneakngar.git
cd phneakngar
```

---

## ៣. ដំឡើង Dependencies

ដំណើរការពាក្យបញ្ជានេះនៅ root នៃគម្រោង។ វាដំឡើង packages ទាំងអស់ក្នុង monorepo៖

```bash
pnpm install
```

> ការដំឡើងលើកដំបូងបង្កើតឯកសារ `.dev.vars` ដោយស្វ័យប្រវត្តិ (តាមរយៈ `predev` script) ដែលរួមមាន `BETTER_AUTH_SECRET` និង `ENCRYPTION_KEY` ដែលបង្កើតដោយចៃដន្យ (random)។ បំពេញ OAuth keys ប្រសិនបើអ្នកត្រូវការ។

---

## ៤. រៀបចំ Database (D1 Migrations)

ភ្នាក់ងារ ប្រើ Cloudflare D1 (SQLite)។ ដំណើរការ migrations ក្នុងមូលដ្ឋាន៖

```bash
pnpm db:migrate
```

ដើម្បីលុប database ក្នុងមូលដ្ឋាន ហើយ migrate ឡើងវិញ៖

```bash
pnpm db:reset
```

---

## ៥. ដំណើរការគម្រោង (Run the App)

### វិធីសាមញ្ញ — ប្រើ onboarding wrapper

```bash
npx @phneakngar/app onboard
```

ពាក្យបញ្ជានេះនឹងណែនាំអ្នកពេញលេញ — ភ្ជាប់ម៉ាស៊ីន, រកឃើញ runtimes, និង deploy agent company ដំបូងរបស់អ្នក។ បន្ទាប់ពីបញ្ចប់ បើក `http://localhost:15210`។

### វិធីសម្រាប់ការអភិវឌ្ឍន៍ក្នុងមូលដ្ឋាន (Local Development)

ពី repository នេះផ្ទាល់៖

```bash
PHNEAKNGAR_PROJECT_ROOT="$PWD" pnpm dev:app
```

ឬដំណើរការ web app និង workers ទាំងអស់ជាមួយគ្នា៖

```bash
pnpm dev
```

ដើម្បីដំណើរការ CLI daemon ដាច់ដោយឡែក៖

```bash
pnpm dev:cli
```

### ដំណើរការ Services ដោយដៃ (បើ wrapper មិនដំណើរការ)

បើ wrapper មិនអាចចាប់ផ្ដើម service ណាមួយ សូមបើក terminal ៣ ផ្សេងគ្នា៖

```bash
# Terminal 1 — Web app
WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 pnpm --filter @phneakngar/web exec next dev --port 15210

# Terminal 2 — Email worker
pnpm --filter @phneakngar/email-worker exec wrangler dev --port 15211 --persist-to ../web/.wrangler/state

# Terminal 3 — WebSocket worker
pnpm --filter @phneakngar/ws-do exec wrangler dev --port 15212 --persist-to ../web/.wrangler/state
```

---

## ៦. URLs ក្នុងមូលដ្ឋាន (Expected Local URLs)

| Service | URL |
|---------|-----|
| Web app | `http://localhost:15210` |
| Email worker | `http://localhost:15211` |
| WebSocket worker | `http://localhost:15212` |

បើក `http://localhost:15210` បន្ទាប់ពី web app ត្រឡប់ `HTTP 200`។

---

## ៧. ផ្ទៀងផ្ទាត់ការដំឡើង (Verify Installation)

ដំណើរការការត្រួតពិនិត្យទាំងនេះ ដើម្បីបញ្ជាក់ថាអ្វីៗដំណើរការត្រឹមត្រូវ៖

```bash
pnpm check:project   # ពិនិត្យ guardrails នៃគម្រោង
pnpm typecheck       # ពិនិត្យ types
pnpm lint            # ពិនិត្យ code style
pnpm test            # ដំណើរការ tests ទាំងអស់
```

---

## ៨. ការដោះស្រាយបញ្ហា (Troubleshooting)

### ដំឡើងឡើងវិញពីដំបូង (Clean Reinstall)

បើមានបញ្ហាជាមួយ dependencies ឬ build artifacts៖

```bash
pnpm reinstall   # លុប node_modules និង artifacts រួចដំឡើងឡើងវិញ
```

ដើម្បីលុបតែ build artifacts៖

```bash
pnpm clean:builds
```

### Bun រកមិនឃើញ

ប្រាកដថា Bun មាននៅក្នុង `PATH` របស់អ្នក៖

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun --version
```

### Port កំពុងប្រើ (Port already in use)

ប្រសិនបើ port `15210`, `15211`, ឬ `15212` កំពុងប្រើ សូមបិទ process ដែលប្រើ port នោះ ឬកំណត់ port ផ្សេង។

---

## ឯកសារពាក់ព័ន្ធ (Related Docs)

- [Source map](docs/source-map.md) — ផែនទី packages
- [Data and state boundaries](docs/data-and-state-boundaries.md)
- [Migrations](docs/migrations.md)
- [CONTRIBUTING.md](CONTRIBUTING.md) — មគ្គុទេសក៍សម្រាប់អ្នករួមចំណែក

---

<p align="center"><em>បង្កើតឡើងដោយ Next.js, Cloudflare Workers, និង Bun ❤️</em></p>

## អាជ្ញាប័ណ្ណ (License)

[Apache-2.0](LICENSE)

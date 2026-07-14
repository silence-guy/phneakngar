<p align="center">
  <img src="./assets/readme-banner.png" alt="ភ្នាក់ងារ — វេទិកា open-source សម្រាប់ដំណើរការក្រុមហ៊ុន AI ផ្ទាល់ខ្លួន" width="800" />
</p>

<p align="center">
  <a href="README.md">English</a>
  ·
  <strong>ភាសាខ្មែរ</strong>
  ·
  <a href="INSTALL.md">ដំឡើងម៉ាស៊ីនភ្នាក់ងារ</a>
  ·
  <a href="CONTRIBUTING.md">រួមចំណែក</a>
</p>

# ភ្នាក់ងារ — មគ្គុទេសក៍ដំឡើងក្នុងមូលដ្ឋាន

**ភ្នាក់ងារ** គឺជាវេទិកា open-source ដែលអាច self-host បាន។ វាភ្ជាប់ AI coding agents ដែលដំណើរការលើម៉ាស៊ីនរបស់អ្នកទៅកាន់អ៊ីមែល ផ្ទាំងគ្រប់គ្រង ភារកិច្ច ប្រតិទិន និងភ្នាក់ងារផ្សេងទៀត។

## ស្ថានភាព package

ការពិនិត្យ public npm នៅថ្ងៃទី **2026-07-14** បានត្រឡប់ `E404` សម្រាប់ `@phneakngar/cli` និង `@phneakngar/app`។ រហូតដល់ package ទាំងនេះត្រូវបាន publish ជាសាធារណៈ សូមប្រើ repository ក្នុងមូលដ្ឋាន ឬ tarball ដែល operator ផ្តល់ឱ្យ។ ពាក្យបញ្ជា npm/`npx` ត្រូវបានបង្ហាញតែក្នុងផ្នែកដែលសម្គាល់ថា package បាន publish រួចប៉ុណ្ណោះ។

## ១. តម្រូវការ

| កម្មវិធី | កំណែ | គោលបំណង |
| --- | --- | --- |
| **Node.js** | `>=20.19.0` | Web, Workers និង CLI runtime |
| **pnpm** | `10.33.0` | Workspace package manager |
| **Bun** | `1.3.14` | Build និង CLI development |

ដំឡើង pnpm និង Bun ប្រសិនបើមិនទាន់មាន៖

```bash
npm install --global pnpm@10.33.0
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
export PATH="$HOME/.bun/bin:$PATH"
bun --version
```

## ២. ដំណើរការ full local stack

```bash
git clone https://github.com/silence-guy/phneakngar.git
cd phneakngar
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev:app onboard
```

បើក `http://localhost:15210` នៅពេល services រួចរាល់។

បើ wrapper មិនអាចចាប់ផ្តើម service សូមប្រើ terminal ៣៖

```bash
# Terminal 1 — Web app
WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 pnpm --filter @phneakngar/web exec next dev --port 15210

# Terminal 2 — Email Worker
pnpm --filter @phneakngar/email-worker exec wrangler dev --port 15211 --persist-to ../web/.wrangler/state

# Terminal 3 — WebSocket Worker
pnpm --filter @phneakngar/ws-do exec wrangler dev --port 15212 --persist-to ../web/.wrangler/state
```

| Service | URL ក្នុងមូលដ្ឋាន |
| --- | --- |
| Web app | `http://localhost:15210` |
| Email Worker | `http://localhost:15211` |
| WebSocket Worker | `http://localhost:15212` |

ពាក្យបញ្ជាខ្លីខាងក្រោមអាចប្រើបានតែបន្ទាប់ពី `@phneakngar/app` ត្រូវបាន publish ទៅ public npm registry៖

```bash
npx @phneakngar/app onboard
```

សម្រាប់ tarball និង app wrapper សូមមើល [src/app/README.md](src/app/README.md)។

## ៣. ដំឡើង CLI សម្រាប់ម៉ាស៊ីនភ្នាក់ងារ

បង្កើត និងដំឡើង tarball ពី repository នេះ៖

```bash
pnpm pack:cli
npm install --global "./src/cli/phneakngar-cli-$(node -p "require('./src/cli/package.json').version").tgz"

phneakngar init
phneakngar doctor
phneakngar login
phneakngar chhlat start
phneakngar status
```

ឬដំឡើង tarball ដែល operator បានផ្តល់៖

```bash
npm install --global ./phneakngar-cli-*.tgz
phneakngar doctor
```

បន្ទាប់ពី `@phneakngar/cli` ត្រូវបាន publish ទៅ public npm registry អ្នកអាចប្រើ៖

```bash
npm install --global @phneakngar/cli --registry=https://registry.npmjs.org
```

សម្រាប់ការដំឡើងម៉ាស៊ីនភ្នាក់ងារពេញលេញ សូមអាន [INSTALL.md](INSTALL.md)។

## ៤. តម្លៃ live-testing បច្ចុប្បន្ន

តម្លៃខាងក្រោមប្រើសម្រាប់ deployment ដែលកំពុងសាកល្បងបច្ចុប្បន្នតែប៉ុណ្ណោះ៖

- Control-plane origin: `https://phneakngar-web.thatsilenceguy.workers.dev`
- Email domain: `cieee.xyz`

តម្លៃទាំងនេះ **មិនមែន** ជាអត្តសញ្ញាណ canonical អចិន្ត្រៃយ៍របស់ផលិតផលទេ។ Operator និងអ្នក self-host ត្រូវកំណត់ origin និង email domain របស់ខ្លួន។ គម្រោងនេះមិនកំណត់ permanent public domain ថ្មីទេ។

## ៥. ពាក្យបញ្ជាអភិវឌ្ឍន៍

```bash
pnpm dev          # web + Email Worker + WebSocket Worker + shared watch
pnpm dev:cli      # CLI/chhlat development
pnpm db:migrate   # local D1 migrations
pnpm db:reset     # លុប local D1 state ហើយ migrate ឡើងវិញ
```

## ៦. ផ្ទៀងផ្ទាត់

```bash
pnpm check:project
pnpm typecheck
pnpm lint
pnpm test
```

## ឯកសារពាក់ព័ន្ធ

- [English README](README.md)
- [Client install guide](INSTALL.md)
- [Contributor guide](CONTRIBUTING.md)
- [Source map](docs/source-map.md)
- [Data and state boundaries](docs/data-and-state-boundaries.md)
- [Migrations](docs/migrations.md)
- [Deployment](DEPLOY.md)

## អាជ្ញាប័ណ្ណ

[Apache-2.0](LICENSE)

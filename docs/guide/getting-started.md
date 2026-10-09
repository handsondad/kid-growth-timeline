# Getting Started

This local application stores its SQLite database and uploaded media under `data/`.
Authentication is intentionally disabled and the development server only binds to
the loopback interface. Do not expose it through a reverse proxy or bind it to a
network interface.

## Prerequisites

- Node.js 22 LTS
- pnpm 10.34.1

## Run Locally

From the project directory:

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The gallery opens directly;
no environment file or account setup is required. Local storage is initialized
under `data/storage` on first start.

## Data and Backups

- SQLite database: `data/app.sqlite3`
- Original photos and generated files: `data/storage/`

Stop the development server before copying `data/` for a backup. Keep backups
private because the application has no sign-in or album password protection.

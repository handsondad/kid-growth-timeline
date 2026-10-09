# Update Guide

## Update the Local Checkout

Stop the development server and back up the `data/` directory before updating:

```bash
git pull
pnpm install
pnpm build
```

Database migrations run automatically when the application starts. Start it again with `pnpm dev` and open [http://127.0.0.1:3000](http://127.0.0.1:3000).

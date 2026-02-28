# Personal Website Template

Minimal static site with Cloudflare Tunnel deployment. Terminal aesthetic, dark theme, single HTML file.

## Quick Start

1. Copy the template: `cp index.html.example index.html`
2. Edit `index.html` with your info
3. Configure GitHub secrets (see below)
4. Push to deploy

## Features

- Single-file site (HTML + inline CSS)
- Dark terminal aesthetic with scanline effect
- Respects `prefers-reduced-motion`
- Mobile responsive
- No build step required

## CI/CD Workflow

`.github/workflows/deploy.yml` performs:

1. Checkout repository
2. Load deploy SSH key via Cloudflare Access tunnel
3. Upload site payload to the origin host
4. Deploy via `/usr/local/sbin/dmz-site-deploy` when present
5. Fall back to `rsync --delete` into `SITE_ROOT` when helper is missing
6. Health-check the site

### Required GitHub Configuration

**Variables** (Settings > Secrets and variables > Actions > Variables):

| Variable | Description |
|----------|-------------|
| `SITE_DOMAIN` | Your domain (e.g., `example.com`) |
| `SSH_HOSTNAME` | Cloudflare tunnel SSH hostname (e.g., `ssh.example.com`) |
| `DEPLOY_USER` | SSH user on server (default: `deploy`) |
| `SITE_NAME` | Site identifier passed to `dmz-site-deploy` (default: `adolago.xyz`) |
| `SITE_ROOT` | Fallback document root for direct sync (default: `/var/www/adolago`) |

**Secrets** (Settings > Secrets and variables > Actions > Secrets):

| Secret | Description |
|--------|-------------|
| `DMZ_GATEWAY_SSH_KEY` | Private SSH key for deploy user |
| `CF_ACCESS_CLIENT_ID` | Cloudflare Access service token ID |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access service token secret |

### Server Setup

Your server needs:
- Cloudflare Tunnel configured
- Deploy user with SSH access
- Either `/usr/local/sbin/dmz-site-deploy`, or write access (via sudo) to `SITE_ROOT` plus `tar` and `rsync`

## Manual Deploy

```bash
# Start Cloudflare tunnel
cloudflared access tcp --hostname ssh.your-domain.com --url localhost:2222 \
  --service-token-id "$CF_ACCESS_CLIENT_ID" --service-token-secret "$CF_ACCESS_CLIENT_SECRET" &
PID=$!

# Sync files
rsync -avz --delete --exclude '.git/' --exclude '.github/' --exclude '.gitignore' \
  . deploy@localhost:/var/www/adolago/ -e 'ssh -p 2222'

# Optional: run site-specific post-deploy hook if available
ssh -p 2222 deploy@localhost 'sudo /usr/local/sbin/dmz-site-deploy adolago.xyz || true'
kill $PID
```

## Local Development

Just open `index.html` in a browser. No server needed.

## Customization

Edit the CSS variables in `:root` to change the theme:

```css
:root {
  --bg: #0a0a0a;      /* Background */
  --panel: #0b0b0b;   /* Card background */
  --line: #202020;    /* Borders */
  --text: #eaeaea;    /* Main text */
  --muted: #b5b5b5;   /* Secondary text */
  --accent: #f5f5f5;  /* Hover states */
}
```

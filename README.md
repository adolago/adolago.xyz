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
3. Upload site files to server via tar stream
4. Restart Caddy web server
5. Health-check the site

### Required GitHub Configuration

**Variables** (Settings > Secrets and variables > Actions > Variables):

| Variable | Description |
|----------|-------------|
| `SITE_DOMAIN` | Your domain (e.g., `example.com`) |
| `SSH_HOSTNAME` | Cloudflare tunnel SSH hostname (e.g., `ssh.example.com`) |
| `DEPLOY_USER` | SSH user on server (default: `deploy`) |

**Secrets** (Settings > Secrets and variables > Actions > Secrets):

| Secret | Description |
|--------|-------------|
| `DMZ_GATEWAY_SSH_KEY` | Private SSH key for deploy user |
| `CF_ACCESS_CLIENT_ID` | Cloudflare Access service token ID |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access service token secret |

### Server Setup

Your server needs:
- Caddy (or nginx) serving static files
- Cloudflare Tunnel configured
- Deploy user with SSH access and sudo for Caddy restart

## Manual Deploy

```bash
# Start Cloudflare tunnel
cloudflared access tcp --hostname ssh.your-domain.com --url localhost:2222 \
  --service-token-id "$CF_ACCESS_CLIENT_ID" --service-token-secret "$CF_ACCESS_CLIENT_SECRET" &
PID=$!

# Sync files
rsync -avz --delete --exclude '.git/' --exclude '.github/' --exclude '.gitignore' \
  . deploy@localhost:/srv/www/site/ -e 'ssh -p 2222'

# Reload server
ssh -p 2222 deploy@localhost sudo systemctl restart caddy
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

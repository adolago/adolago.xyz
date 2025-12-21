# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal website template. Single-page HTML site with embedded CSS, no build step required.

## Deployment

Automated via GitHub Actions on push to `main`. The workflow (`.github/workflows/deploy.yml`):
1. Establishes SSH tunnel through Cloudflare Access
2. Uploads site files via tar stream to `/var/www/html`
3. Reloads Caddy web server
4. Health checks the configured domain

Required secrets: `DMZ_GATEWAY_SSH_KEY`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`
Required variables: `SITE_DOMAIN`, `SSH_HOSTNAME`, `DEPLOY_USER`

## Local Development

Open `index.html` directly in a browser. No server or build process needed.

## Architecture

- `index.html` - Complete site (markup + styles inlined) - gitignored, copy from `index.html.example`
- Dark theme with CSS custom properties (`--bg`, `--panel`, `--line`, etc.)
- Monospace terminal aesthetic with scanline animation effect
- Respects `prefers-reduced-motion` for accessibility

# adolago.xyz

Static site served from `dmz-gateway` via Cloudflare Tunnel.

## CI/CD workflow

`.github/workflows/deploy.yml` performs:

1. Checkout repository.
2. Join the tailnet using the Tailscale GitHub Action (requires `TAILSCALE_AUTHKEY`).
3. Load the deploy SSH key (`DMZ_GATEWAY_SSH_KEY`).
4. `rsync --delete` the repository contents (excluding Git metadata) to `/srv/www/adolago` on `dmz-gateway`.
5. Reload Caddy (`sudo systemctl reload caddy`).

Repository secrets needed:
- `TAILSCALE_AUTHKEY` – ephemeral Tailscale auth key.
- `DMZ_GATEWAY_SSH_KEY` – private key allowed on `/home/deploy/.ssh/authorized_keys`.
- `DEPLOY_HOST` – currently `100.81.223.14`.

## Manual deploy

```bash
rsync -avz --delete --exclude '.git/' --exclude '.github/' --exclude '.gitignore' . deploy@100.81.223.14:/srv/www/adolago/
ssh deploy@100.81.223.14 sudo systemctl reload caddy
```

## Notes

- Guest LAN is isolated from the main LAN; management happens over Tailscale.
- Cloudflare tunnel `adolago-prod` proxies both apex (`adolago.xyz`) and `www`.

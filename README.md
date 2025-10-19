# adolago.xyz

Static site served from `dmz-gateway` via Cloudflare Tunnel.

## CI/CD workflow

`.github/workflows/deploy.yml` performs:

1. Checkout repository.
2. Load the deploy SSH key (`DMZ_GATEWAY_SSH_KEY`).
3. Install `cloudflared` and configure SSH to proxy through Cloudflare Access.
4. `rsync --delete` the repository contents (excluding Git metadata) to `/srv/www/adolago` on `dmz-gateway`.
5. Reload Caddy (`sudo systemctl reload caddy`).

Repository secrets needed:
- `DMZ_GATEWAY_SSH_KEY` – private key allowed on `/home/deploy/.ssh/authorized_keys`.
- `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` – Cloudflare Access service token for the SSH application.
- `DEPLOY_HOST` – retained for reference (`100.81.223.14`).

## Manual deploy

```bash
cloudflared access ssh --hostname ssh.adolago.xyz --service-token-id "$CF_ACCESS_CLIENT_ID" --service-token-secret "$CF_ACCESS_CLIENT_SECRET"
rsync -avz --delete --exclude '.git/' --exclude '.github/' --exclude '.gitignore' . deploy@ssh.adolago.xyz:/srv/www/adolago/
ssh deploy@ssh.adolago.xyz sudo systemctl reload caddy
```

## Notes

- Guest LAN is isolated from the main LAN; management runs over Cloudflare Access.
- Cloudflare tunnel `adolago-prod` proxies both apex (`adolago.xyz`) and `www`.

# adolago.xyz

Static site served from `dmz-gateway` via Cloudflare Tunnel.

## CI/CD workflow

`.github/workflows/deploy.yml` performs:

1. Checkout repository.
2. Load the deploy SSH key (`DMZ_GATEWAY_SSH_KEY`).
3. Install `cloudflared` and configure SSH to proxy through Cloudflare Access.
4. Upload the repository payload (excluding Git metadata) via a `tar` stream to `/srv/www/adolago` on `dmz-gateway` and replace previous contents.
5. Restart Caddy (`sudo systemctl restart caddy`).
6. Health‑check `https://adolago.xyz` until it responds (< 400).

Repository secrets needed:
- `DMZ_GATEWAY_SSH_KEY` – private key allowed on `/home/deploy/.ssh/authorized_keys`.
- `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` – Cloudflare Access service token for the SSH application.
- `DEPLOY_HOST` – retained for reference (`100.81.223.14`).

## Manual deploy

```bash
cloudflared access tcp --hostname ssh.adolago.xyz --url localhost:2222 \
  --service-token-id "$CF_ACCESS_CLIENT_ID" --service-token-secret "$CF_ACCESS_CLIENT_SECRET" &
PID=$!
rsync -avz --delete --exclude '.git/' --exclude '.github/' --exclude '.gitignore' . deploy@localhost:/srv/www/adolago/ -e 'ssh -p 2222'
ssh -p 2222 deploy@localhost sudo systemctl restart caddy
kill $PID
```

## Notes

- Guest LAN is isolated from the main LAN; management runs over Cloudflare Access.
- Cloudflare tunnel `adolago-prod` proxies both apex (`adolago.xyz`) and `www`.

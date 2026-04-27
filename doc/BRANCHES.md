# Branch Roles

This fork keeps branch history and live deployment separate.

- `dev` on `origin` is the history branch for deployment and ops changes.
- `deploy/live` is the live service worktree and tracks `upstream/master`.
- Feature work still belongs on focused branches such as `fix/...`, `feat/...`, or `docs/...`.

Operational rule:

- Use `/root/paperclip/deploy/update-paperclip.sh` to refresh the live service.
- Do not deploy the live service directly from `dev` unless that branch has been intentionally synced to the upstream line.

# Releasing Brinkwood Reforged

Foundry installs and updates the system from `system.json` on `main`. The manifest points to a tagged GitHub archive; no separate upload to Foundry is required.

## Release flow

1. Create feature branches from `develop` and merge them back through pull requests.
2. Keep `develop` green, then open a release pull request from `develop` to `main`.
3. In that release pull request:
   - choose the next immutable version, such as `1.0.0-rc.2`;
   - update `system.json` `version` and its `download` URL to the matching `v1.0.0-rc.2` tag;
   - update release assertions and release notes;
   - remove or update branch-only development manifests such as `system-dev.json`.
4. Run the focused tests, full suite, system validation, and CSS parity check.
5. Merge the release pull request into `main`.
6. Tag the exact merge commit on `main` with an annotated tag and push it:

   ```bash
   git switch main
   git pull --ff-only origin main
   git tag -a v1.0.0-rc.2 -m "Brinkwood Reforged v1.0.0-rc.2"
   git push origin v1.0.0-rc.2
   ```

7. Optionally create a GitHub Release from the same tag.
8. Verify that the public `main/system.json` reports the new version and that its `download` URL resolves to the new tag archive.

Never move or reuse a published tag. If an RC needs correction, publish the next RC number. After a release or hotfix from `main`, merge the resulting changes back into `develop`.

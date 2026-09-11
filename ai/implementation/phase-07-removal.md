# Phase 07 - Obsolete Path Removal

## Objective
Commit the dedicated app to cooldown combat and remove obsolete local-distribution paths after behavior is protected.

## Scope
- Remove timer-mode branches, settings, UI, and events.
- Remove quick-adjust if inventory confirms it is unused.
- Remove PyInstaller path logic, build files, tunnel files, release workflow, dependency, and tracked artifacts.
- Add or preserve a focused GitHub Actions test workflow that runs the Python suite on pushes and pull requests.
- Verify the test workflow fails when a test fails and passes on the retained code.
- Configure GitHub branch protection to require the test check before merging to `main`, if repository permissions/settings allow it.
- Preserve valued sounds/theme behavior.

## Dependencies
Phases 02-04 and 06, plus deployment verification.

## Deliverables
- Simplified dedicated app.
- Dependency cleanup.
- No obsolete executable release pipeline.
- Focused GitHub Actions test workflow.
- Documented local and CI test commands.
- Branch-protection/test-check configuration record, if configured.

## Success criteria
- Cooldown tests pass locally.
- The CI test workflow passes on the retained code.
- A deliberately failing test causes the CI workflow to fail, then the temporary failing change is removed.
- The CI workflow runs on pushes and pull requests.
- The test check is required before merging to `main`, or the repository records why branch protection could not be configured.
- `python app.py` works.
- Vercel deploys.
- Retained assets/features remain functional.

## CI workflow order

Complete these steps before deleting `.github/workflows/build.yml`:

1. Add a focused test workflow, such as `.github/workflows/tests.yml`.
2. Install the supported Python version and project dependencies.
3. Run `python -m unittest discover -s tests -v`.
4. Confirm the workflow passes on the current branch.
5. Temporarily introduce a harmless failing assertion on a disposable branch or commit and confirm the workflow fails.
6. Remove the temporary failing assertion and confirm the workflow passes again.
7. Configure branch protection/rulesets to require the test check for `main` when available.
8. Only then remove the old PyInstaller release workflow and related build files.
9. Update the README and Phase 14 handoff with the CI command and workflow name.

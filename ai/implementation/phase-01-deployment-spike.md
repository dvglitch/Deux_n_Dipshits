# Phase 01 - Deployment and Runtime Feasibility Spike

Status: Ready for execution after Phase 00 baseline.

## Objective
Determine exactly how the current GitHub-to-Vercel deployment runs Flask, Flask-SocketIO, background timers, and shared state. Produce an evidence-based hosting decision before source, persistence, or realtime architecture changes.

## Why this phase comes first
The current application assumes a long-lived Flask process, threaded Socket.IO, a background timer loop, and shared in-memory state. Vercel may run the app with a different lifecycle. If that assumption is wrong, later work could build a clean architecture around an unreliable runtime.

## Scope

### Included

- Verify the GitHub repository, production branch, and Vercel project connection.
- Record Vercel root directory, framework preset, build/install commands, Python entry point, environment variables, and deployment behavior.
- Inspect successful and failed deployment logs.
- Establish a safe preview/test deployment path.
- Test HTTP, Socket.IO, timer progression, reconnect, state sharing, restart behavior, and persistence prerequisites.
- Record free-tier/provider constraints relevant to the final architecture.

### Explicitly excluded

- New campaign or combat features.
- Source-package reorganization.
- Deleting build files or the GitHub release workflow.
- Production database migration.
- Renaming Socket.IO events.
- Broad UI redesign.

## Inputs and prerequisites

- Phase 00 baseline is complete.
- Access to the Vercel project dashboard and deployment logs.
- Access to the connected GitHub repository.
- A local Python environment that can run the current app.
- A browser or client capable of opening the current routes and maintaining Socket.IO connections.
- A temporary test deployment or preview branch that does not disrupt the Monday production session.

Do not put provider secrets, Vercel tokens, or deployment credentials in the repository or in these notes.

## Work sequence

### 1. Capture the current baseline

Record the current commit/branch, local Python version, dependency installation result, exact startup command, routes that load, local timer/Socket.IO behavior, and existing warnings. Use disposable test state where possible and do not use a production campaign save for experiments.

### 2. Inspect Vercel configuration

In the Vercel project dashboard, record the connected repository and branch, root directory, framework preset, install/build commands, output directory, functions/runtime settings, environment-variable names by scope, and latest successful deployment commit.

Open deployment logs and identify the build command Vercel executes, the Python file/function it invokes, whether `app.py` is imported directly, whether static/templates are included, and whether runtime errors appear after a successful build. Create a redacted record; never copy secret values.

### 3. Establish an HTTP smoke test

For production or preview, verify Home, Control, Display, DM, Remote, and QR routes plus a representative API response such as sound listing if retained. Record status codes and console/server errors.

### 4. Test Socket.IO connectivity

Using two browser contexts or devices, connect both clients, record transport and success, trigger one harmless retained state change, confirm both receive the canonical update, disconnect/reconnect one client, and confirm it receives current state rather than empty/default state. Repeat under a fresh page or network context if practical.

### 5. Test timer lifecycle

Start a controlled timer, observe progression and completion, confirm display updates without manual requests, test retained pause/lock behavior, compare a second client, refresh one client, and repeat after the deployment has been idle. Record whether the background task remains alive.

### 6. Test deployment restart behavior

Use a preview deployment or safe deployment event. Record live-client behavior, reconnect after readiness, check whether disposable state resets or stalls, verify campaign/settings data remains available, and determine whether multiple instances can disagree about live state. A disposable-state reset is acceptable; unexplained split-brain state is not.

### 7. Check persistence prerequisites

Do not migrate application data yet. For provisional Supabase, verify current free-tier database/storage limits, billing requirements, Vercel connection method, pooling/serverless guidance, export/backup options, and object-storage fit for five portraits. If Supabase is unsuitable, record why and evaluate Neon plus separate free portrait storage.

### 8. Write the decision record

End with one outcome:

- **Supported:** Vercel can host the current realtime model with documented limitations.
- **Supported with changes:** HTTP/database can remain on Vercel but realtime or timer authority needs a specific change.
- **Not suitable:** move realtime authority to a compatible service/host before feature implementation.

The decision must include evidence, not only an opinion.

## Expected files

Prefer documentation and test probes over application edits. Likely outputs are a redacted deployment/runtime record in `ai/`, a temporary test script or test case if needed, and environment-variable documentation without secrets. Do not reorganize `app.py` during this phase; that belongs to Phase 03.

## Validation checklist

- [ ] Baseline local run recorded.
- [ ] Vercel project/repository connection recorded.
- [ ] Build/runtime entry point identified.
- [ ] Production/preview environment names recorded without secrets.
- [ ] HTTP smoke tests pass or failures are explained.
- [ ] Two-client Socket.IO update test completed.
- [ ] Socket.IO reconnect behavior recorded.
- [ ] Background timer progression tested.
- [ ] Deployment restart behavior tested.
- [ ] State-reset behavior classified as acceptable or unacceptable.
- [ ] Free-tier provider constraints recorded.
- [ ] Hosting decision written with evidence.
- [ ] Follow-up work assigned to later phases.

## Success criteria

This phase is complete when:

1. We can explain how Vercel builds and starts the application.
2. We know whether ordinary Flask routes work in production.
3. We know whether Socket.IO clients share and recover canonical state.
4. We know whether the background timer model survives the deployment lifecycle.
5. We know whether a restart may safely clear disposable state without losing campaign data.
6. We have enough provider information to choose persistence in Phase 05.
7. Any architecture change required by Vercel is documented before Phase 03 begins.

## Failure handling

Do not fix a failed deployment by adding unrelated architecture during the spike. Keep a minimal reproduction and relevant log excerpt. Classify each failure as build/path resolution, HTTP runtime, Socket.IO transport, background-task lifecycle, persistence connectivity, or client behavior. If evidence shows the intended live architecture cannot run reliably on the free hosting arrangement, stop and make a hosting decision before proceeding.

## Handoff to Phase 02

Provide the runtime/deployment decision, required environment variables, hosting constraints, route/static/template constraints, Socket.IO and timer findings, provider shortlist, unresolved questions, and exact probes that should become characterization tests.

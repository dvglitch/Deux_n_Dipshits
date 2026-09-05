# Phase 06 - Realtime Cleanup

## Objective
Replace accumulated Socket.IO patches with explicit commands, centralized transitions, validation, and canonical broadcasts.

## Scope
- Inventory event names, payloads, listeners, mutations, and broadcasts.
- Define command/event contracts and connection bootstrap.
- Make server transitions authoritative.
- Define reconnect, persistence failure, and disposable-state reset behavior.
- Keep sounds/notifications separate from state mutation.

## Dependencies
Phases 02-05.

## Deliverables
Event contract, realtime package, state-transition service, payload validation, and realtime tests.

## Success criteria
Two clients converge, reconnect receives canonical state, invalid commands fail clearly, and timer progression remains responsive.

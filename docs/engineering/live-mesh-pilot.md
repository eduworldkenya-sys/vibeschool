# VibeMesh Live Classroom pilot

VibeMesh uses the existing Live Classroom session, authentication, Join Live link, roster and raised-hand workflow. It handles one adult teacher and one adult test learner per session. WebRTC carries audio directly between the two browsers. Supabase stores and delivers the private signaling through the authenticated Live-admission RPC. STUN assists discovery across networks. Some networks need a relay and should use the existing Daily audio path.

## Isolated pilot

- Apply the migration and run the Live Classroom Pilot checks in an isolated environment. The migration starts with an empty pilot table.
- Use a dedicated room and two existing, consenting adult test accounts. The operator verifies the account holders' age and consent outside the app. Provision the exact Live session UUID and both auth user IDs in the private `vibe_live.mesh_pilot` table. Set `verified_adults_at` to the time of verification and `expires_at` no later than two hours after it. The learner must still join through the current classroom and meet its canonical admission requirements.
- Set `NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ENABLED=true` and `NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ROOM_ID` to the dedicated room UUID in the isolated build. Existing Live voice must be enabled. Omit the Mesh settings on normal deployments.
- Verify with separate devices on distinct networks, including Android. Join with both existing accounts and check that the microphone starts off. Test consent, both audio directions, mute, raised-hand approval and revocation, pause, resume, end, logout, connectivity loss and Daily fallback. A failed direct connection offers **Use Daily audio**. Both peers observe the shared switch. Daily retains its existing **Join audio** interaction and access checks.
- Record connection success and time to first audio, mute and revoke behavior, disconnections, and fallback success. Keep SDP, IP addresses, tokens and account identifiers out of shared test notes.

## Stop and clean up

Pause the Live lesson to interrupt both peers and clear current media state. Ending the lesson removes the pilot row. On rollback, disable the Mesh flags and end the dedicated lesson or remove its private row. Remove expired abandoned pilot rows through the isolated database operator at the end of each trial.

Direct peers can see network information from ICE. Peer-to-peer media relies on cooperative clients and cannot enforce remote ejection the way a media server can. Keep this isolated to the authorized adult pair until independent safety and reliability verification supports a broader release.

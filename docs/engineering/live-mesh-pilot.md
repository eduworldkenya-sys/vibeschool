# VibeMesh Live Classroom group pilot

VibeMesh uses the existing Live Classroom session, authentication, Join Live link, roster and raised-hand workflow. A dedicated pilot room supports one adult teacher and up to eight authorized adult learners. Each learner has one WebRTC audio connection to the teacher. With the teacher's permission, an adult learner can speak to the group through the teacher's browser. One learner can hold the speaking turn. Supabase delivers signaling only to authorized recipients.

## Isolated pilot

- Apply the migration to an isolated environment. It provisions no rooms or learner seats.
- Use a dedicated session. Verify the teacher's and each learner's age and consent outside the app. As database operator, provision the session UUID, teacher auth UUID, verification time and expiry in `vibe_live.mesh_pilot`. The expiry must be within two hours of verification.
- For each verified adult learner, provision the same room UUID, a unique seat from 1 through 8, their auth UUID and matching canonical student ID in `vibe_live.mesh_pilot_seats`. Each participant still needs to join through the current classroom and pass its usual admission checks.
- Set `NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ENABLED=true` and `NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ROOM_ID` to the dedicated room UUID in the isolated build. Existing Live voice must be enabled. Omit the Mesh settings on normal deployments.
- Verify a teacher and at least two adult learners on separate physical devices and networks, including Android. Test microphone consent, teacher broadcast, approved learner relay, switching speakers, mute, permission removal, pause, resume, end, logout and connection failures. Exercise all eight seats before approving the maximum pilot load.
- The teacher can choose **Use Daily audio** for the entire room. The room also switches to Daily if an ordinary classroom participant without a pilot seat joins. Both paths invalidate the direct connections first. Daily uses its existing **Join audio** interaction and access checks.
- Record delivery, time to first audio, disconnection and fallback results. Keep SDP, IP addresses, tokens and account identifiers out of shared test notes.

## Stop and clean up

Pause to drop all voice connections and clear their signaling state. Ending the lesson removes the pilot and its seats. To roll back, disable the flags and end the dedicated lesson or remove its private pilot row. Remove expired, abandoned pilot rows after each trial.

Direct peers exchange ICE network information. STUN supports discovery but some networks require a relay. Teacher upload and processing increase with each learner. The teacher's browser is the audio relay and cannot enforce server-side moderation against non-cooperative clients. Keep this limited to approved adult pilot accounts while validating larger groups and a class-wide media transport.

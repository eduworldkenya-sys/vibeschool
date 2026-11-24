# VibeMesh in Live Classroom

Go Live and Join Live start VibeMesh for participants admitted through the existing classroom. There is no separate voice approval, invitation or setup. The current direct-audio engine supports one teacher and eight simultaneous learner connections in each classroom. Learners can still attend the lesson if all audio connections are occupied.

Each learner connects to the teacher. Microphones initially stay off. The teacher can allow one raised-hand learner to speak to the room and stop that speaking turn. Signaling stays scoped to the current room and recipient. The existing classroom authentication, membership and open-class admission rules apply.

## Operations

- Daily is muted in production. The VibeMesh UI uses the existing Live voice switch and displays an audio error if the signaling RPC is unavailable. Explicit restoration of Daily requires its server and client settings.
- Leaving audio frees capacity. A stale device or revoked classroom membership invalidates the corresponding signaling lease. Pausing closes audio connections. Ending a lesson clears its signaling and seat records.
- Verify capacity, microphone consent, permission changes and disconnects on separate devices and networks. The teacher's browser relays audio and direct connections exchange ICE network information. Larger classes and networks requiring a media relay need additional transport capacity.

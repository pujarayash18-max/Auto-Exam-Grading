# Backlog (Scheduled for Future Phases)

## Phase 2: Super Admin and settings
- `GET /public/branding` (unauthenticated) for login page branding.
- Add endpoint for logo upload.

## Phase 3: Admin panels
- Excel imports must implement a `preview_id` along with a diff summary for the preview step.
- The commit endpoint will consume `preview_id`, `mode` (replace vs add), and explicit confirmation.

## Phase 4: Faculty scheduling and material
- Decide whether faculty study materials and question banks are kept at the faculty-library level or strictly isolated per-exam.

## Phase 5: Live viva
- `viva.finish` WS payload must include `evaluated_basis` (asked vs planned).
- Provide a full REST fallback for finishing a viva.
- Provide a `client next-question` trigger mechanism.
- `audio.chunk` format constraints: **big-endian uint32 seq**, chunk duration, and MIME type metadata.
- On WS reconnect, the server must report the **last received sequence_no** to sync streams safely.
- WS Auth updates: provide `auth.ok` and enforce an `auth timeout`.
- Keep viva state in Redis/DB exclusively—**not** in Python process memory, allowing stateless websocket scaling.
- Models must be loaded **once per worker**, avoiding per-request initialization.
- Implement a dedicated STT worker/queue.
- Define environment variables `WHISPER_LIVE_MODEL` (e.g. base) and `WHISPER_FINAL_MODEL` (e.g. small).
- Store segment-to-question time offsets within transcripts.

## Phase 6: Grading, results, recordings
- Introduce an expected marks/grade event or `GET /sessions/{id}/result`.
- Allow per-attempt overrides via dedicated endpoint.
- Specify the request body schema for publish endpoints.
- Add a faculty browser interface for recordings.
- Backend must stitch/merge audio segments into a single file at the finish line.
- Provide short-lived signed URLs for media streaming.
- Export student transcript text endpoint.
- Endpoint for requesting download bundle files.

## Cross-cutting (Throughout Development)
- Adopt a single standard for pagination and filtering conventions across all lists.
- Adopt a single standard for error response shapes across all endpoints.
- Ollama default model configuration: target ~3B parameter class for environments with <=16GB RAM, remaining strictly configurable.

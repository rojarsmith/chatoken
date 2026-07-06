# Streaming Chat and Job Cancellation

[English](streaming-chat-cancel.md) | [繁體中文](streaming-chat-cancel.zh-TW.md)

This stage adds two runtime behaviors that real chat systems need:

- streaming chat output so users can see tokens arrive before the full answer is complete;
- cancellation for queued or running jobs.

The implementation is intentionally simple for learning. Streaming uses newline
delimited JSON events, and cancellation is cooperative.

## Streaming Chat

Endpoint:

```text
POST /chat/stream
```

Each response line is one JSON event:

```json
{"event":"start","model_id":"random-tiny-byte","prompt_tokens":31}
{"event":"token","delta":"A","reply":"A","tokens_generated":1}
{"event":"done","result":{"model_id":"random-tiny-byte","reply":"..."}}
```

Smoke test with Windows Command Prompt:

```cmd
curl -N -s -X POST http://127.0.0.1:8000/chat/stream ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"message\":\"Every effort moves you\",\"max_new_tokens\":12,\"temperature\":0}"
```

The Web UI Chat view now reads this stream and updates the output as token
events arrive.

## Cancel Endpoints

```text
POST /chat/jobs/{job_id}/cancel
POST /training/jobs/{job_id}/cancel
POST /pretrained/jobs/{job_id}/cancel
```

Example:

```cmd
curl -s -X POST "http://127.0.0.1:8000/training/jobs/%TRAINING_JOB_ID%/cancel"
```

The returned job has `cancel_requested=true`. If the job was still queued, its
status becomes `cancelled` immediately. If it was running, the worker stops at
the next safe cancellation check and then records `status=cancelled`.

## Learning Point

Streaming and cancellation are runtime coordination features. They do not
change model weights or model quality.

Streaming changes how generated tokens are delivered:

```text
generate one token -> emit event -> update UI -> continue
```

Cancellation changes how long-running tasks cooperate with the API:

```text
user clicks Cancel -> API sets cancel_requested -> worker checks flag -> worker exits safely
```

The API does not forcibly kill the Python process or worker thread. That keeps
model state, files, and the local development server safer.

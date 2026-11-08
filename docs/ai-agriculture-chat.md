# AI Agriculture Assistant

The AgriMonitor `/agri-chat` page streams agricultural answers from an Ollama server through the FastAPI backend. It is authenticated and retains only the latest 10 user/assistant messages in the current page session.

## Local setup

Install and start Ollama, then run:

```powershell
ollama pull qwen2.5:7b
cd agrimonitor_backend
pip install -e .
copy .env.example .env
```

Set `OLLAMA_BASE_URL=http://localhost:11434` in the backend `.env`, then start the backend and frontend using the normal AgriMonitor instructions.

## Render setup

Render cannot reach Ollama at `localhost` on a developer's computer. Set `OLLAMA_BASE_URL` in the backend Render service to an Ollama endpoint reachable from Render. Install the selected model on that Ollama server with `ollama pull <model>`. Set `OLLAMA_MODEL` to the exact installed model name if it differs from the default.

Do not expose an unauthenticated Ollama port to the public internet. Restrict network access or place Ollama behind HTTPS and an authentication proxy; if that proxy accepts a bearer token, store it as `OLLAMA_API_KEY` in Render's secret environment variables.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL of the Ollama server |
| `OLLAMA_API_KEY` | empty | Optional bearer token for an authenticated proxy |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Installed model used by the assistant |
| `OLLAMA_TEMPERATURE` | `0.4` | Response consistency |
| `OLLAMA_NUM_CTX` | `4096` | Context window |
| `OLLAMA_NUM_PREDICT` | `400` | Maximum generated tokens |

The assistant provides general guidance, not a confirmed diagnosis. Follow pesticide and fertilizer labels and consult the Department of Agriculture or MARDI when uncertain.

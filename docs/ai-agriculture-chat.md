# AI Agriculture Assistant

The AgriMonitor `/agri-chat` page streams agricultural answers from Ollama Cloud through the FastAPI backend. It is authenticated and retains only the latest 10 user/assistant messages in the current page session.

## Development setup

Configure Ollama Cloud in the backend `.env`, then start the backend and frontend using the normal AgriMonitor instructions:

```powershell
cd agrimonitor_backend
pip install -e .
copy .env.example .env
```

Use `OLLAMA_BASE_URL=https://ollama.com`, `OLLAMA_MODEL=beam`, and set `OLLAMA_API_KEY` to a key you create at [ollama.com/settings/keys](https://ollama.com/settings/keys). Keep the key secret. The `beam:cloud` name is for the Ollama CLI; direct API requests use `beam`.

## Render setup

The Render blueprint sets `OLLAMA_BASE_URL` to `https://ollama.com` and `OLLAMA_MODEL` to `beam`. Add your Ollama key as the backend's secret `OLLAMA_API_KEY` environment variable. Ollama Cloud usage may require credits or a paid plan.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `https://ollama.com` | Ollama Cloud API base URL |
| `OLLAMA_API_KEY` | empty | Ollama Cloud API key; required for cloud chat |
| `OLLAMA_MODEL` | `beam` | Cloud model used by the assistant |
| `OLLAMA_TEMPERATURE` | `0.4` | Response consistency |
| `OLLAMA_NUM_CTX` | `4096` | Context window |
| `OLLAMA_NUM_PREDICT` | `400` | Maximum generated tokens |

The assistant provides general guidance, not a confirmed diagnosis. Follow pesticide and fertilizer labels and consult the Department of Agriculture or MARDI when uncertain.

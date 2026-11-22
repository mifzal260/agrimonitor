# AI Agriculture Assistant

The AgriMonitor `/agri-chat` page streams agricultural answers from the DeepSeek API through the FastAPI backend. It is authenticated and retains only the latest 10 user/assistant messages in the current page session.

## Development setup

Configure DeepSeek in the backend `.env`, then start the backend and frontend using the normal AgriMonitor instructions:

```powershell
cd agrimonitor_backend
pip install -e .
copy .env.example .env
```

Use `DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_MODEL=deepseek-flash`, and set `DEEPSEEK_API_KEY` to a key created in the [DeepSeek platform](https://platform.deepseek.com/api_keys). Keep the key secret. The assistant enables thinking mode with `DEEPSEEK_REASONING_EFFORT=high` while streaming only the final answer to the browser.

## Render setup

The Render blueprint sets `DEEPSEEK_BASE_URL` to `https://api.deepseek.com`, `DEEPSEEK_MODEL` to `deepseek-flash`, and `DEEPSEEK_REASONING_EFFORT` to `high`. Add your DeepSeek key as the backend's secret `DEEPSEEK_API_KEY` environment variable. DeepSeek API usage requires sufficient account balance.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API base URL |
| `DEEPSEEK_API_KEY` | empty | DeepSeek API key; required for chat |
| `DEEPSEEK_MODEL` | `deepseek-flash` | Model used by the assistant |
| `DEEPSEEK_REASONING_EFFORT` | `high` | Thinking effort (`low`, `high`, or `max`) |
| `DEEPSEEK_MAX_TOKENS` | `400` | Maximum generated tokens, including reasoning |

The assistant provides general guidance, not a confirmed diagnosis. Follow pesticide and fertilizer labels and consult the Department of Agriculture or MARDI when uncertain.

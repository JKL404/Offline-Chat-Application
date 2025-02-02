# Backend API for Offline Chat API

## Requirements
- Python 3.9+
- Ollama installed and running

## Installation

### 1. Install Ollama
Follow platform-specific instructions:

#### macOS
```bash
curl -fsSL https://ollama.com/install.sh | sh
```
or

Download installer from [ollama.com/download/Ollama-darwin.zip](https://ollama.com/download/Ollama-darwin.zip)

#### Windows
Download installer from [ollama.com/download/OllamaSetup.exe](https://ollama.com/download/OllamaSetup.exe)

#### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Start Ollama Service
```bash
ollama serve
```

### 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

## Running the Backend
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 3000
```

## Environment Variables
```env
OLLAMA_HOST=http://localhost:11434  # Change if Ollama is running remotely
```

## API Endpoints

### Text Generation
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain quantum computing", "model": "llama2"}'
```

### Text Generation with Parameters
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a poem about artificial intelligence",
    "model": "llama3.2",
    "temperature": 0.9,
    "max_tokens": 256,
    "top_p": 0.95,
    "presence_penalty": 1.2
  }'
```

### Chat Interface
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "llama2"}'
```

### Chat Interface with System Prompt
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Suggest a healthy meal plan"}
    ],
    "model": "mistral",
    "system_prompt": "You are a nutrition expert with 20 years of experience. Provide detailed explanations.",
    "temperature": 0.5,
    "max_tokens": 1024,
    "top_k": 50,
    "presence_penalty": 1.1
  }'
```

### Model Management

#### List Available Models
```bash
curl http://localhost:3000/api/tags
```

#### Download New Model
```bash
curl -X POST http://localhost:3000/api/pull \
  -H "Content-Type: application/json" \
  -d '{"llm_name": "mistral"}'
```

### Advanced Parameters
| Parameter         | Type    | Description                          | Range       |
|-------------------|---------|--------------------------------------|-------------|
| `temperature`     | float   | Creativity vs coherence              | 0.0 - 1.0   |
| `top_p`           | float   | Nucleus sampling threshold           | 0.0 - 1.0   |
| `top_k`           | int     | Limit top token selection            | 1 - 100     |
| `max_tokens`      | int     | Maximum response length              | 1 - 4096    |
| `presence_penalty`| float   | Reduce repetition in output          | 0.0 - 5.0   |
| `seed`            | int     | Reproducible outputs                 | Any integer |

## Supported Models
| Model        | Command                      | Size    |
|--------------|------------------------------|---------|
| Llama 2      | `ollama run llama2`          | 3.8GB   |
| Mistral      | `ollama run mistral`         | 4.1GB   |
| Code Llama   | `ollama run codellama`       | 3.8GB   |
| LLaVA        | `ollama run llava`           | 4.5GB   |

**System Requirements:**
- Minimum 8GB RAM for 7B parameter models
- 16GB RAM for 13B parameter models
- 32GB RAM for 33B+ parameter models

> Note: Model sizes are approximate and may vary based on quantization method

> **Example Configuration Tips:**
> - Creative writing: `temperature=0.9`, `top_p=0.95`
> - Technical answers: `temperature=0.3`, `presence_penalty=1.3`
> - Balanced chat: `temperature=0.7`, `top_k=40`
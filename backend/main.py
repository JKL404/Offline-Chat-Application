import json
import logging
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from ollama import AsyncClient
import os

# FastAPI
app = FastAPI()

# Logger
logger = logging.getLogger(__name__)

# Use local Ollama instance
client = AsyncClient(
    host=os.getenv('OLLAMA_HOST', 'http://localhost:11434'),
    timeout=20
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Query(BaseModel):
    """
    Query for generating text
    """
    prompt: str
    model: str = "llama2"
    stream: Optional[bool] = True  # Default to streaming
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=1.0)
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0, description="Controls diversity via nucleus sampling")
    top_k: Optional[int] = Field(default=40, ge=0, description="Limits top token selection")
    max_tokens: Optional[int] = Field(default=512, ge=1, description="Maximum length of response")
    seed: Optional[int] = Field(default=None, description="Random seed for reproducibility")
    presence_penalty: Optional[float] = Field(default=1.1, ge=0.0, le=5.0, description="Penalize new tokens based on existence in text")


class ChatQuery(BaseModel):
    """
    Query for chat with Ollama
    """
    model: str = Field(default="llama2", example="llama2")
    messages: List[Dict[str, str]] = Field(..., example=[{
        "role": "user", 
        "content": "Hello"
    }])
    system_prompt: Optional[str] = None
    stream: Optional[bool] = True
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=1.0)
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0)
    top_k: Optional[int] = Field(default=40, ge=0)
    max_tokens: Optional[int] = Field(default=512, ge=1)
    seed: Optional[int] = Field(default=None)
    presence_penalty: Optional[float] = Field(default=1.1, ge=0.0, le=5.0)


def create_options_dict(
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    top_k: Optional[int] = None,
    max_tokens: Optional[int] = None,
    seed: Optional[int] = None,
    presence_penalty: Optional[float] = None
) -> dict:
    """Create a cleaned options dictionary with non-None values"""
    options = {
        'temperature': temperature,
        'top_p': top_p,
        'top_k': top_k,
        'num_predict': max_tokens,
        'seed': seed,
        'repeat_penalty': presence_penalty,
        'mirostat': 2,
        'mirostat_tau': 5.0,
        'mirostat_eta': 0.1
    }
    return {k: v for k, v in options.items() if v is not None}


# Async generator for extracting "response" from /api/generate (Streaming)
async def stream_generated_text(
    prompt: str,
    model: str,
    temperature: float,
    top_p: float,
    top_k: int,
    max_tokens: int,
    seed: int,
    presence_penalty: float
):
    """
    Stream generated text from Ollama
    """
    response = await client.generate(
        model=model,
        prompt=prompt,
        options=create_options_dict(
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_tokens=max_tokens,
            seed=seed,
            presence_penalty=presence_penalty
        ),
        stream=True
    )
    
    async for chunk in response:
        yield chunk.response


# Helper function for non-streaming response from /api/generate
async def get_generated_text(prompt: str, model: str, temperature: float):
    """
    Get generated text from Ollama
    """
    response = await client.generate(
        model=model,
        prompt=prompt,
        options=create_options_dict(temperature=temperature),
        stream=False
    )
    return {"response": response.response}


# Async generator for chat streaming
async def stream_chat_response(
    messages: List[Dict[str, str]],
    model: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    top_p: float = 0.9,
    top_k: int = 40,
    max_tokens: int = 512,
    seed: int = None,
    presence_penalty: float = 0.0
):
    """
    Stream chat response from Ollama with proper error handling
    """
    try:
        # Add system prompt if provided
        if system_prompt:
            messages.insert(0, {"role": "system", "content": system_prompt})
        
        response = await client.chat(
            model=model,
            messages=messages,
            options=create_options_dict(
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                max_tokens=max_tokens,
                seed=seed,
                presence_penalty=presence_penalty
            ),
            stream=True
        )
        
        async for chunk in response:
            if chunk.message and chunk.message.content:
                # Proper SSE format with data: prefix and double newlines
                yield f"data: {json.dumps({'content': chunk.message.content})}\n\n"
        
        # Send completion event
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Error streaming chat response: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


# Helper for non-streaming chat
async def get_chat_response(
    messages: List[Dict[str, str]],
    model: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    top_p: float = 0.9,
    top_k: int = 40,
    max_tokens: int = 512,
    seed: int = None,
    presence_penalty: float = 0.0
):
    """
    Get chat response from Ollama
    """
    try:
        # Add system prompt if provided
        if system_prompt:
            messages.insert(0, {"role": "system", "content": system_prompt})
        
        response = await client.chat(
            model=model,
            messages=messages,
            options=create_options_dict(
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                max_tokens=max_tokens,
                seed=seed,
                presence_penalty=presence_penalty
            ),
            stream=False
        )
        # Convert Message object to serializable dictionary
        return {
            "role": response.message.role,
            "content": response.message.content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint for /generate that handles both streaming and non-streaming
@app.post("/api/generate")
async def generate_text(query: Query):
    """
    Generate text from Ollama
    """
    if query.stream:
        return StreamingResponse(
            stream_generated_text(
                prompt=query.prompt,
                model=query.model,
                temperature=query.temperature,
                top_p=query.top_p,
                top_k=query.top_k,
                max_tokens=query.max_tokens,
                seed=query.seed,
                presence_penalty=query.presence_penalty
            ),
            media_type="text/plain"
        )
    else:
        response = await get_generated_text(
            prompt=query.prompt,
            model=query.model,
            temperature=query.temperature
        )
        return JSONResponse(response)


async def stream_pull_progress(llm_name: str):
    """
    Stream pull progress from Ollama
    """
    try:
        async for progress in await client.pull(model=llm_name, stream=True):
            # Convert ProgressResponse to serializable format
            data = json.dumps({
                'status': progress.status,
                'completed': progress.completed,
                'total': progress.total,
                'digest': getattr(progress, 'digest', ''),
                'message': getattr(progress, 'message', '')
            })
            yield f"data: {data}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


@app.post("/api/pull")
async def download_model(
    llm_name: str = Body(..., embed=True)
):
    """
    Download a model from Ollama with streaming progress
    """
    return StreamingResponse(
        stream_pull_progress(llm_name),
        media_type="text/event-stream"
    )


@app.get("/api/tags")
async def list_models():
    """
    List all models from Ollama
    """
    try:
        # Correct method call using AsyncClient
        response = await client.list()
        return {"models": response["models"]}
    except Exception as e:
        logger.error(f"Error fetching models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching models: {str(e)}")

# New chat endpoint
@app.post("/api/chat")
async def chat_endpoint(query: ChatQuery):
    """
    Chat with Ollama with proper streaming headers
    """
    if query.stream:
        return StreamingResponse(
            stream_chat_response(
                messages=query.messages,
                model=query.model,
                system_prompt=query.system_prompt,
                temperature=query.temperature,
                top_p=query.top_p,
                top_k=query.top_k,
                max_tokens=query.max_tokens,
                seed=query.seed,
                presence_penalty=query.presence_penalty
            ),
            media_type="text/event-stream",
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        )
    else:
        try:
            response = await get_chat_response(
                messages=query.messages,
                model=query.model,
                system_prompt=query.system_prompt,
                temperature=query.temperature,
                top_p=query.top_p,
                top_k=query.top_k,
                max_tokens=query.max_tokens,
                seed=query.seed,
                presence_penalty=query.presence_penalty
            )
            return JSONResponse({"message": response})
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
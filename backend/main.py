import os
from typing import Dict, List
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

app = FastAPI(title="AI SHARAF API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

memories: Dict[str, List[dict]] = {}
knowledge: List[dict] = []
tasks: Dict[str, dict] = {}

class ChatRequest(BaseModel):
    user_id: str
    message: str

class TaskRequest(BaseModel):
    user_id: str
    objective: str
    priority: int = 5

@app.get("/")
def root():
    return {"name": "AI SHARAF API", "version": "0.2.0", "status": "ok"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(400, "message is required")
    key = os.getenv("OPENAI_API_KEY")
    if OpenAI and key:
        client = OpenAI(api_key=key)
        response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-5-mini"),
            input=req.message,
        )
        answer = response.output_text
    else:
        answer = "AI SHARAF backend متصل، لكن مفتاح نموذج الذكاء الاصطناعي غير مضبوط على الخادم."
    memories.setdefault(req.user_id, []).append({"memory_type": "chat", "content": req.message, "confidence": 1.0})
    return {"answer": answer}

@app.get("/memory/search")
def memory_search(user_id: str, q: str = ""):
    rows = memories.get(user_id, [])
    if q:
        ql = q.lower()
        rows = [x for x in rows if ql in x["content"].lower()]
    return {"results": rows[-50:][::-1]}

@app.get("/knowledge/search")
def knowledge_search(q: str = ""):
    if not q:
        return {"results": knowledge[-50:][::-1]}
    ql = q.lower()
    return {"results": [x for x in knowledge if ql in (x.get("title", "") + " " + x.get("content", "")).lower()][::-1]}

@app.post("/tasks")
def create_task(req: TaskRequest):
    if not req.objective.strip():
        raise HTTPException(400, "objective is required")
    task_id = str(uuid4())
    task = {"task_id": task_id, "user_id": req.user_id, "objective": req.objective, "priority": req.priority, "status": "queued"}
    tasks[task_id] = task
    return task

@app.get("/tasks/{task_id}")
def get_task(task_id: str):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(404, "task not found")
    return task

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
import uuid
import logging
import hashlib
from sqlalchemy.orm import Session
from database import SessionLocal, User, engine

# Initialize modules
from travel_planner_agent import TravelPlannerAgent, TravelState

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Auth Models ---
class UserCreate(BaseModel):
    name: str
    email: str
    phone: str
    aadhar: str
    blood_group: str
    profession: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    status: str
    profession: Optional[str] = None
    class Config:
        orm_mode = True

class StatusUpdate(BaseModel):
    user_id: int
    status: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# --- Auth Routes ---
@app.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user.password)
    new_user = User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        aadhar=user.aadhar,
        blood_group=user.blood_group,
        profession=user.profession,
        hashed_password=hashed,
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    hashed = hash_password(user.password)
    db_user = db.query(User).filter(User.email == user.email, User.hashed_password == hashed).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    return {
        "message": "Login successful",
        "user": {
            "id": db_user.id,
            "name": db_user.name,
            "status": db_user.status,
            "email": db_user.email,
            "profession": db_user.profession
        }
    }

@app.post("/status")
def update_status(data: StatusUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == data.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.status = data.status
    db.commit()
    return {"message": "Status updated", "status": db_user.status}

# --- Chat/Agent Logic ---
sessions: Dict[str, TravelState] = {}
agent = TravelPlannerAgent()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: dict
    session_id: str

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        session_id = request.session_id
        if not session_id or session_id not in sessions:
            session_id = str(uuid.uuid4())
            sessions[session_id] = TravelState()
            print(f"Created new session: {session_id}")
        
        current_state = sessions[session_id]
        updated_state = agent.update_state(current_state, request.message)
        sessions[session_id] = updated_state
        
        return ChatResponse(
            response=updated_state.to_dict(),
            session_id=session_id
        )
    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reset")
async def reset_endpoint(request: ChatRequest):
    session_id = request.session_id
    if session_id and session_id in sessions:
        sessions[session_id] = TravelState()
        print(f"Forced reset for session {session_id}")
    return {"status": "reset", "session_id": session_id}

@app.get("/health")
async def health_check():
    return {"status": "ok", "agent": "Gemini 2.5 Flash Travel Planner"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

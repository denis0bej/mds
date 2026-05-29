import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import auth, game

init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Handle requests with /game prefix (GameLoop, MapView)
app.include_router(game.router, prefix="/game")

# Handle requests without /game prefix (CharacterCreation)
app.include_router(game.router)

app.include_router(auth.router)
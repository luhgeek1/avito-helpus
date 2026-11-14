from fastapi import APIRouter

from app.api import system
from app.api.v1 import admin, auth, chat, knowledge, me, people_ops, plan, requests

v1_router = APIRouter(prefix="/v1")
v1_router.include_router(auth.router)
v1_router.include_router(me.router)
v1_router.include_router(plan.router)
v1_router.include_router(requests.router)
v1_router.include_router(knowledge.router)
v1_router.include_router(chat.router)
v1_router.include_router(people_ops.escalations_router)
v1_router.include_router(people_ops.mentees_router)
v1_router.include_router(people_ops.notifications_router)
v1_router.include_router(people_ops.integrations_router)
v1_router.include_router(admin.router)

api_router = APIRouter(prefix="/api")
api_router.include_router(system.router)
api_router.include_router(v1_router)

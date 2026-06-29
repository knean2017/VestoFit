from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.shopping import ShoppingQuery
from app.models.user import User
from app.rate_limit import rate_limit_search
from app.schemas.shopping import (
    ShoppingAskRequest,
    ShoppingAskResponse,
    ShoppingHistoryItem,
    ShoppingSearchRequest,
    ShoppingSearchResponse,
)
from app.services.shopping_service import ask_shopping_assistant, search_products

router = APIRouter(prefix="/shopping", tags=["shopping"])


@router.post("/search", response_model=ShoppingSearchResponse, dependencies=[Depends(rate_limit_search)])
async def search(
    payload: ShoppingSearchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await search_products(
        query=payload.query,
        budget_max=payload.budget_max,
        category=payload.category,
        country=payload.country,
        city=payload.city,
        lat=payload.lat,
        lng=payload.lng,
    )

    record = ShoppingQuery(
        user_id=user.id,
        query=payload.query,
        budget_max=payload.budget_max,
        category=payload.category,
        results_json={"results": [r.model_dump() for r in result["results"]]},
    )
    db.add(record)
    await db.commit()

    return ShoppingSearchResponse(
        query=payload.query,
        results=result["results"],
        total=len(result["results"]),
        city=payload.city,
        currency=result["currency"],
        no_local=result["no_local"],
    )


@router.post("/ask", response_model=ShoppingAskResponse, dependencies=[Depends(rate_limit_search)])
async def ask(
    payload: ShoppingAskRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    history = None
    if payload.history:
        history = [{"role": m.role, "content": m.content} for m in payload.history]

    result = await ask_shopping_assistant(
        payload.prompt,
        history,
        country=payload.country,
        city=payload.city,
        lat=payload.lat,
        lng=payload.lng,
    )

    return ShoppingAskResponse(
        reply=result["reply"],
        results=result.get("results"),
        search_query=result.get("search_query"),
        chips=result.get("chips"),
        city=payload.city,
        currency=result.get("currency", "USD"),
        no_local=result.get("no_local", False),
    )


@router.get("/history", response_model=list[ShoppingHistoryItem])
async def history(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    q = (
        select(ShoppingQuery)
        .where(ShoppingQuery.user_id == user.id)
        .order_by(ShoppingQuery.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(q)
    items: list[ShoppingHistoryItem] = []
    for row in res.scalars().all():
        rj = row.results_json or {}
        items.append(
            ShoppingHistoryItem(
                id=str(row.id),
                query=row.query,
                budget_max=row.budget_max,
                category=row.category,
                result_count=len(rj.get("results", [])),
                created_at=row.created_at,
            )
        )
    return items

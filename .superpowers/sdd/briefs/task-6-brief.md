### Task 6: Shopping Backend — Model, Schema, Config

**Files:**
- Create: `backend/app/models/shopping.py`
- Create: `backend/app/schemas/shopping.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/config.py`

**Interfaces:**
- Consumes: existing `Base` from `app.database`, `User` model pattern
- Produces: `ShoppingQuery` ORM model, `ShoppingSearchRequest`/`ShoppingResultItem`/`ShoppingSearchResponse` Pydantic schemas, `serpapi_key` config field

- [ ] **Step 1: Create `backend/app/models/shopping.py`**

```python
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShoppingQuery(Base):
    __tablename__ = "shopping_queries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    budget_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    results_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

- [ ] **Step 2: Create `backend/app/schemas/shopping.py`**

```python
from datetime import datetime

from pydantic import BaseModel, Field


class ShoppingSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    budget_max: float | None = Field(default=None, gt=0)
    category: str | None = None


class ShoppingResultItem(BaseModel):
    title: str
    price: float
    currency: str = "USD"
    image_url: str
    product_url: str
    source: str
    category: str | None = None


class ShoppingSearchResponse(BaseModel):
    query: str
    results: list[ShoppingResultItem]
    total: int


class ShoppingHistoryItem(BaseModel):
    id: str
    query: str
    budget_max: float | None
    category: str | None
    result_count: int
    created_at: datetime
```

- [ ] **Step 3: Register model in `__init__.py`**

Add to `backend/app/models/__init__.py`:

```python
from app.models.shopping import ShoppingQuery
```

And add `"ShoppingQuery"` to the `__all__` list.

- [ ] **Step 4: Add `serpapi_key` to config**

In `backend/app/config.py`, add inside the `Settings` class:

```python
serpapi_key: str = ""
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/shopping.py backend/app/schemas/shopping.py backend/app/models/__init__.py backend/app/config.py
git commit -m "feat: add shopping model, schemas, and config"
```

---


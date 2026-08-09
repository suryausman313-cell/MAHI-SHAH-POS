from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///./pos.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, default="General")
    price = Column(Float, nullable=False)
    active = Column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    order_type = Column(String, default="takeaway")
    status = Column(String, default="new")
    payment_method = Column(String, default="cash")
    subtotal = Column(Float, default=0)
    vat = Column(Float, default=0)
    total = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("OrderItem", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    menu_item_id = Column(Integer)
    name = Column(String)
    qty = Column(Integer, default=1)
    unit_price = Column(Float)


Base.metadata.create_all(bind=engine)


class MenuItemIn(BaseModel):
    name: str
    category: str = "General"
    price: float
    active: bool = True


class CartItem(BaseModel):
    menu_item_id: int
    qty: int = 1


class OrderIn(BaseModel):
    items: List[CartItem]
    order_type: str = "takeaway"
    payment_method: str = "cash"


app = FastAPI(title="Restaurant POS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def seed():
    db = SessionLocal()

    if db.query(MenuItem).count() == 0:
        db.add_all([
            MenuItem(name="Margherita Pizza", category="Pizza", price=25),
            MenuItem(name="Chicken Burger", category="Burger", price=18),
            MenuItem(name="French Fries", category="Sides", price=10),
            MenuItem(name="Cola", category="Drinks", price=5),
        ])
        db.commit()

    db.close()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/menu")
def get_menu():
    db = SessionLocal()

    rows = db.query(MenuItem).filter(MenuItem.active == True).all()

    data = [
        {
            "id": x.id,
            "name": x.name,
            "category": x.category,
            "price": x.price,
            "active": x.active
        }
        for x in rows
    ]

    db.close()
    return data


@app.get("/admin/menu")
def admin_menu():
    db = SessionLocal()

    rows = db.query(MenuItem).all()

    data = [
        {
            "id": x.id,
            "name": x.name,
            "category": x.category,
            "price": x.price,
            "active": x.active
        }
        for x in rows
    ]

    db.close()
    return data


@app.post("/admin/menu")
def add_item(item: MenuItemIn):
    db = SessionLocal()

    row = MenuItem(**item.model_dump())

    db.add(row)
    db.commit()
    db.refresh(row)

    item_id = row.id

    db.close()
    return {"id": item_id}


@app.delete("/admin/menu/{item_id}")
def delete_item(item_id: int):
    db = SessionLocal()

    row = db.query(MenuItem).filter(MenuItem.id == item_id).first()

    if not row:
        db.close()
        raise HTTPException(404, "Item not found")

    db.delete(row)
    db.commit()
    db.close()

    return {"ok": True}


@app.post("/orders")
def create_order(payload: OrderIn):
    db = SessionLocal()

    selected = []
    subtotal = 0.0

    for ci in payload.items:
        m = db.query(MenuItem).filter(
            MenuItem.id == ci.menu_item_id,
            MenuItem.active == True
        ).first()

        if not m:
            db.close()
            raise HTTPException(400, f"Invalid menu item {ci.menu_item_id}")

        qty = max(1, ci.qty)
        subtotal += m.price * qty
        selected.append((m, qty))

    vat = round(subtotal * 0.05, 2)
    total = round(subtotal + vat, 2)

    order = Order(
        order_type=payload.order_type,
        payment_method=payload.payment_method,
        subtotal=round(subtotal, 2),
        vat=vat,
        total=total,
        status="new"
    )

    for m, qty in selected:
        order.items.append(
            OrderItem(
                menu_item_id=m.id,
                name=m.name,
                qty=qty,
                unit_price=m.price
            )
        )

    db.add(order)
    db.commit()
    db.refresh(order)

    order_id = order.id

    db.close()

    return {
        "id": order_id,
        "subtotal": round(subtotal, 2),
        "vat": vat,
        "total": total
    }


@app.get("/orders")
def get_orders(status: Optional[str] = None):
    db = SessionLocal()

    q = db.query(Order)

    if status:
        q = q.filter(Order.status == status)

    rows = q.order_by(Order.id.desc()).all()

    data = []

    for o in rows:
        data.append({
            "id": o.id,
            "status": o.status,
            "order_type": o.order_type,
            "payment_method": o.payment_method,
            "subtotal": o.subtotal,
            "vat": o.vat,
            "total": o.total,
            "created_at": o.created_at.isoformat(),
            "items": [
                {
                    "name": i.name,
                    "qty": i.qty,
                    "unit_price": i.unit_price
                }
                for i in o.items
            ]
        })

    db.close()
    return data


@app.patch("/orders/{order_id}/status/{status}")
def set_status(order_id: int, status: str):
    allowed = {
        "new",
        "preparing",
        "ready",
        "completed",
        "cancelled"
    }

    if status not in allowed:
        raise HTTPException(400, "Invalid status")

    db = SessionLocal()

    o = db.query(Order).filter(Order.id == order_id).first()

    if not o:
        db.close()
        raise HTTPException(404, "Order not found")

    o.status = status

    db.commit()
    db.close()

    return {"ok": True}


@app.get("/reports/today")
def report_today():
    db = SessionLocal()

    rows = db.query(Order).filter(Order.status != "cancelled").all()

    total = round(sum(o.total for o in rows), 2)

    cash = round(
        sum(o.total for o in rows if o.payment_method == "cash"),
        2
    )

    card = round(
        sum(o.total for o in rows if o.payment_method == "card"),
        2
    )

    data = {
        "orders": len(rows),
        "sales": total,
        "cash": cash,
        "card": card
    }

    db.close()
    return data

from datetime import datetime, date, timedelta
from typing import Optional, List, Any
import json, os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime,
    Boolean, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pos.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


# -------------------- DATABASE MODELS --------------------

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, default="")


class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, default="General")
    price = Column(Float, nullable=False)
    barcode = Column(String, default="")
    sku = Column(String, default="")
    active = Column(Boolean, default=True)


class Modifier(Base):
    __tablename__ = "modifiers"
    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"))
    name = Column(String, nullable=False)
    price = Column(Float, default=0)
    active = Column(Boolean, default=True)


class Table(Base):
    __tablename__ = "tables"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    seats = Column(Integer, default=4)
    status = Column(String, default="available")
    x = Column(Float, default=0)
    y = Column(Float, default=0)


class Staff(Base):
    __tablename__ = "staff"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, default="cashier")
    pin = Column(String, default="1234")
    permissions = Column(Text, default="[]")
    active = Column(Boolean, default=True)


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True)
    staff_id = Column(Integer, ForeignKey("staff.id"))
    clock_in = Column(DateTime, default=datetime.utcnow)
    clock_out = Column(DateTime, nullable=True)


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String, default="")
    address = Column(Text, default="")
    points = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    unit = Column(String, default="pcs")
    qty = Column(Float, default=0)
    min_qty = Column(Float, default=0)
    cost = Column(Float, default=0)


class RecipeComponent(Base):
    __tablename__ = "recipe_components"
    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"))
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"))
    qty = Column(Float, default=0)


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String, default="")
    email = Column(String, default="")


class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    total = Column(Float, default=0)
    status = Column(String, default="received")
    created_at = Column(DateTime, default=datetime.utcnow)


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    id = Column(Integer, primary_key=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"))
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"))
    qty = Column(Float, default=0)
    cost = Column(Float, default=0)


class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(Integer, primary_key=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"))
    movement_type = Column(String, default="adjustment")
    qty = Column(Float, default=0)
    reason = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    amount = Column(Float, default=0)
    category = Column(String, default="General")
    created_at = Column(DateTime, default=datetime.utcnow)


class Shift(Base):
    __tablename__ = "shifts"
    id = Column(Integer, primary_key=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    status = Column(String, default="open")
    opening_cash = Column(Float, default=0)
    cash_sales = Column(Float, default=0)
    card_sales = Column(Float, default=0)
    cash_in = Column(Float, default=0)
    cash_out = Column(Float, default=0)
    expected_cash = Column(Float, default=0)
    actual_cash = Column(Float, nullable=True)
    difference = Column(Float, nullable=True)
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    notes = Column(Text, default="")


class CashMovement(Base):
    __tablename__ = "cash_movements"
    id = Column(Integer, primary_key=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    movement_type = Column(String, default="in")
    amount = Column(Float, default=0)
    reason = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class DayClose(Base):
    __tablename__ = "day_closes"
    id = Column(Integer, primary_key=True)
    business_date = Column(String, nullable=False)
    closed_by = Column(Integer, ForeignKey("staff.id"), nullable=True)
    sales = Column(Float, default=0)
    cash = Column(Float, default=0)
    card = Column(Float, default=0)
    vat = Column(Float, default=0)
    discounts = Column(Float, default=0)
    refunds = Column(Float, default=0)
    expenses = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    discount_type = Column(String, default="fixed")
    value = Column(Float, default=0)
    active = Column(Boolean, default=True)


class Printer(Base):
    __tablename__ = "printers"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, default="receipt")
    ip = Column(String, default="")
    port = Column(Integer, default=9100)
    auto_print = Column(Boolean, default=True)
    categories = Column(Text, default="[]")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor_staff_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)
    entity = Column(String, default="")
    entity_id = Column(String, default="")
    details = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    order_type = Column(String, default="takeaway")
    table_id = Column(Integer, nullable=True)
    waiter_id = Column(Integer, nullable=True)
    customer_id = Column(Integer, nullable=True)
    shift_id = Column(Integer, nullable=True)
    status = Column(String, default="new")
    payment_method = Column(String, default="cash")
    cash_paid = Column(Float, default=0)
    card_paid = Column(Float, default=0)
    subtotal = Column(Float, default=0)
    discount = Column(Float, default=0)
    vat = Column(Float, default=0)
    total = Column(Float, default=0)
    refund_amount = Column(Float, default=0)
    coupon_code = Column(String, default="")
    delivery_address = Column(Text, default="")
    notes = Column(Text, default="")
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
    modifiers = Column(Text, default="[]")
    notes = Column(Text, default="")




class ProductMedia(Base):
    __tablename__ = "product_media"
    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), unique=True)
    image_data = Column(Text, default="")

class SizeOption(Base):
    __tablename__ = "size_options"
    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"))
    name = Column(String, nullable=False)
    price_delta = Column(Float, default=0)
    active = Column(Boolean, default=True)


class Deal(Base):
    __tablename__ = "deals"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    price = Column(Float, default=0)
    active = Column(Boolean, default=True)
    rules = Column(Text, default="[]")


class KitchenStation(Base):
    __tablename__ = "kitchen_stations"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    categories = Column(Text, default="[]")
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=True)
    active = Column(Boolean, default=True)


class Reservation(Base):
    __tablename__ = "reservations"
    id = Column(Integer, primary_key=True)
    customer_name = Column(String, nullable=False)
    phone = Column(String, default="")
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    party_size = Column(Integer, default=2)
    reservation_at = Column(DateTime, nullable=False)
    status = Column(String, default="booked")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class StockTransfer(Base):
    __tablename__ = "stock_transfers"
    id = Column(Integer, primary_key=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"))
    qty = Column(Float, default=0)
    from_location = Column(String, default="Main")
    to_location = Column(String, default="Branch")
    status = Column(String, default="completed")
    created_at = Column(DateTime, default=datetime.utcnow)


class ReceiptAsset(Base):
    __tablename__ = "receipt_assets"
    id = Column(Integer, primary_key=True)
    asset_type = Column(String, default="logo")
    data_url = Column(Text, default="")


Base.metadata.create_all(bind=engine)


# -------------------- HELPERS --------------------

def db_session():
    return SessionLocal()


def get_setting(db, key, default):
    r = db.query(Setting).filter(Setting.key == key).first()
    return r.value if r else default


def put_setting(db, key, value):
    r = db.query(Setting).filter(Setting.key == key).first()
    if r:
        r.value = str(value)
    else:
        db.add(Setting(key=key, value=str(value)))


def log_action(db, action, entity="", entity_id="", actor=None, details=""):
    db.add(AuditLog(
        actor_staff_id=actor,
        action=action,
        entity=entity,
        entity_id=str(entity_id or ""),
        details=details
    ))


def staff_by_pin(db, pin):
    return db.query(Staff).filter(Staff.pin == pin, Staff.active == True).first()


def manager_check(db, pin):
    staff = staff_by_pin(db, pin)
    if not staff or staff.role not in {"admin", "manager"}:
        raise HTTPException(403, "Manager/Admin PIN required")
    return staff


def order_to_dict(db, o):
    table = db.query(Table).filter(Table.id == o.table_id).first() if o.table_id else None
    waiter = db.query(Staff).filter(Staff.id == o.waiter_id).first() if o.waiter_id else None
    customer = db.query(Customer).filter(Customer.id == o.customer_id).first() if o.customer_id else None
    return {
        "id": o.id, "status": o.status, "order_type": o.order_type,
        "table_id": o.table_id, "table": table.name if table else None,
        "waiter_id": o.waiter_id, "waiter": waiter.name if waiter else None,
        "customer_id": o.customer_id, "customer": customer.name if customer else None,
        "shift_id": o.shift_id,
        "payment_method": o.payment_method,
        "cash_paid": o.cash_paid, "card_paid": o.card_paid,
        "subtotal": o.subtotal, "discount": o.discount, "vat": o.vat,
        "total": o.total, "refund_amount": o.refund_amount,
        "coupon_code": o.coupon_code, "delivery_address": o.delivery_address,
        "notes": o.notes, "created_at": o.created_at.isoformat(),
        "items": [{
            "id": i.id, "menu_item_id": i.menu_item_id, "name": i.name,
            "qty": i.qty, "unit_price": i.unit_price,
            "modifiers": json.loads(i.modifiers or "[]"), "notes": i.notes
        } for i in o.items]
    }


def stock_apply_for_order(db, order, direction=-1):
    for oi in order.items:
        comps = db.query(RecipeComponent).filter(
            RecipeComponent.menu_item_id == oi.menu_item_id
        ).all()
        for c in comps:
            inv = db.query(InventoryItem).filter(
                InventoryItem.id == c.inventory_item_id
            ).first()
            if inv:
                qty = c.qty * oi.qty * direction
                inv.qty += qty
                db.add(StockMovement(
                    inventory_item_id=inv.id,
                    movement_type="sale" if direction < 0 else "refund",
                    qty=qty,
                    reason=f"Order #{order.id}"
                ))



def flag(db, key: str, default=True):
    return str(get_setting(db, key, "true" if default else "false")).lower() == "true"

def current_open_shift(db):
    return db.query(Shift).filter(Shift.status == "open").order_by(Shift.id.desc()).first()


def recalc_shift(db, shift):
    if not shift:
        return
    orders = db.query(Order).filter(
        Order.shift_id == shift.id,
        Order.status.notin_(["cancelled", "held"])
    ).all()
    shift.cash_sales = round(sum(max(0, o.cash_paid) - (o.refund_amount if o.payment_method == "cash" else 0) for o in orders), 2)
    shift.card_sales = round(sum(max(0, o.card_paid) - (o.refund_amount if o.payment_method == "card" else 0) for o in orders), 2)
    movements = db.query(CashMovement).filter(CashMovement.shift_id == shift.id).all()
    shift.cash_in = round(sum(m.amount for m in movements if m.movement_type == "in"), 2)
    shift.cash_out = round(sum(m.amount for m in movements if m.movement_type == "out"), 2)
    shift.expected_cash = round(shift.opening_cash + shift.cash_sales + shift.cash_in - shift.cash_out, 2)


def seed():
    db = db_session()
    if db.query(MenuItem).count() == 0:
        db.add_all([
            MenuItem(name="Margherita Pizza", category="Pizza", price=25, barcode="1001"),
            MenuItem(name="Pepperoni Pizza", category="Pizza", price=30, barcode="1002"),
            MenuItem(name="Chicken Burger", category="Burger", price=18, barcode="2001"),
            MenuItem(name="French Fries", category="Sides", price=10, barcode="3001"),
            MenuItem(name="Cola", category="Drinks", price=5, barcode="4001"),
        ])
    if db.query(Table).count() == 0:
        db.add_all([Table(name=f"Table {i}", seats=4) for i in range(1, 9)])
    if db.query(Staff).count() == 0:
        db.add_all([
            Staff(name="Admin", role="admin", pin="1111", permissions='["all"]'),
            Staff(name="Cashier", role="cashier", pin="2222"),
            Staff(name="Waiter 1", role="waiter", pin="3333"),
            Staff(name="Kitchen", role="kitchen", pin="4444"),
        ])
    if db.query(InventoryItem).count() == 0:
        db.add_all([
            InventoryItem(name="Flour", unit="kg", qty=20, min_qty=5, cost=3),
            InventoryItem(name="Cheese", unit="kg", qty=10, min_qty=3, cost=25),
            InventoryItem(name="Cola Can", unit="pcs", qty=48, min_qty=12, cost=1.5),
        ])
    defaults = {
        "shop_name": "My Restaurant",
        "shop_phone": "0500000000",
        "shop_address": "Fujairah, UAE",
        "trn": "",
        "vat_percent": "5",
        "receipt_footer": "Thank you!",
        "printer_ip": "",
        "printer_port": "9100",
        "auto_print": "false",
        "kitchen_sound": "true",
        "require_shift": "true",
        "currency": "AED",
        "payment_terminal_provider": "",
        "payment_terminal_enabled": "false",
        "customer_display_enabled": "true",
        "offline_queue_enabled": "true",
        "receipt_logo": "",
        "app_enabled": "true",
        "shop_open": "true",
        "vat_enabled": "true",
        "vat_inclusive": "true",
        "cashier_card_size": "auto",
        "business_timezone_offset_minutes": "240",
        "morning_sales_label": "Morning",
        "morning_sales_start": "08:00",
        "morning_sales_end": "16:00",
        "evening_sales_label": "Evening",
        "evening_sales_start": "16:00",
        "evening_sales_end": "01:00",
        "allow_discounts": "true",
        "allow_coupons": "false",
        "allow_refunds": "true",
        "allow_voids": "true",
        "allow_hold_orders": "true",
        "allow_split_payment": "true",
        "allow_delivery": "true",
        "allow_dinein": "false",
        "allow_takeaway": "true",
        "allow_customer_display": "true",
        "allow_waiter_payment": "false",
        "kitchen_can_cancel": "true",
        "manager_pin_required_for_kitchen_cancel": "true",
        "show_prices_in_kitchen": "false",
        "show_shift_to_waiter": "false",
        "show_shift_to_kitchen": "false",
        "auto_cash_drawer": "true",
    }
    for k, v in defaults.items():
        if not db.query(Setting).filter(Setting.key == k).first():
            db.add(Setting(key=k, value=v))
    if db.query(Printer).count() == 0:
        db.add(Printer(name="Receipt Printer", role="receipt", ip="", port=9100, auto_print=True))
    db.commit()
    db.close()


seed()


# -------------------- SCHEMAS --------------------

class LoginIn(BaseModel):
    pin: str

class ManagerIn(BaseModel):
    pin: str

class MenuItemIn(BaseModel):
    name: str
    category: str = "General"
    price: float
    barcode: str = ""
    sku: str = ""
    active: bool = True

class ModifierIn(BaseModel):
    menu_item_id: int
    name: str
    price: float = 0

class TableIn(BaseModel):
    name: str
    seats: int = 4
    x: float = 0
    y: float = 0

class TableTransferIn(BaseModel):
    from_table_id: int
    to_table_id: int

class StaffIn(BaseModel):
    name: str
    role: str
    pin: str
    permissions: List[str] = []
    active: bool = True

class CustomerIn(BaseModel):
    name: str
    phone: str = ""
    address: str = ""

class InventoryIn(BaseModel):
    name: str
    unit: str = "pcs"
    qty: float = 0
    min_qty: float = 0
    cost: float = 0

class StockAdjustIn(BaseModel):
    qty: float
    reason: str = "Manual adjustment"

class RecipeIn(BaseModel):
    inventory_item_id: int
    qty: float

class SupplierIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""

class PurchaseLine(BaseModel):
    inventory_item_id: int
    qty: float
    cost: float = 0

class PurchaseIn(BaseModel):
    supplier_id: Optional[int] = None
    items: List[PurchaseLine]

class WasteIn(BaseModel):
    inventory_item_id: int
    qty: float
    reason: str = "Wastage"

class ExpenseIn(BaseModel):
    title: str
    amount: float
    category: str = "General"

class ShiftOpenIn(BaseModel):
    staff_id: Optional[int] = None
    opening_cash: float = 0
    notes: str = ""

class ShiftCloseIn(BaseModel):
    actual_cash: float
    staff_pin: str
    notes: str = ""

class CashMovementIn(BaseModel):
    movement_type: str
    amount: float
    reason: str

class CouponIn(BaseModel):
    code: str
    discount_type: str = "fixed"
    value: float
    active: bool = True

class PrinterIn(BaseModel):
    name: str
    role: str = "receipt"
    ip: str = ""
    port: int = 9100
    auto_print: bool = True
    categories: List[str] = []

class OrderItemIn(BaseModel):
    menu_item_id: int
    qty: int = 1
    size_id: Optional[int] = None
    modifier_ids: List[int] = []
    notes: str = ""

class OrderIn(BaseModel):
    items: List[OrderItemIn]
    order_type: str = "takeaway"
    payment_method: str = "cash"
    cash_paid: Optional[float] = None
    card_paid: Optional[float] = None
    table_id: Optional[int] = None
    waiter_id: Optional[int] = None
    customer_id: Optional[int] = None
    shift_id: Optional[int] = None
    discount: float = 0
    coupon_code: str = ""
    delivery_address: str = ""
    notes: str = ""
    hold: bool = False

class SplitPaymentIn(BaseModel):
    cash: float = 0
    card: float = 0

class RefundIn(BaseModel):
    amount: Optional[float] = None
    manager_pin: str
    reason: str = ""

class VoidIn(BaseModel):
    manager_pin: str
    reason: str = ""

class SettingsIn(BaseModel):
    shop_name: str
    shop_phone: str
    shop_address: str
    trn: str = ""
    vat_percent: float = 5
    receipt_footer: str = "Thank you!"
    printer_ip: str = ""
    printer_port: int = 9100
    auto_print: bool = False
    kitchen_sound: bool = True
    require_shift: bool = True
    currency: str = "AED"
    payment_terminal_provider: str = ""
    payment_terminal_enabled: bool = False
    app_enabled: bool = True
    shop_open: bool = True
    vat_enabled: bool = True
    vat_inclusive: bool = True
    cashier_card_size: str = "auto"
    business_timezone_offset_minutes: int = 240
    morning_sales_label: str = "Morning"
    morning_sales_start: str = "08:00"
    morning_sales_end: str = "16:00"
    evening_sales_label: str = "Evening"
    evening_sales_start: str = "16:00"
    evening_sales_end: str = "01:00"
    allow_discounts: bool = True
    allow_coupons: bool = True
    allow_refunds: bool = True
    allow_voids: bool = True
    allow_hold_orders: bool = True
    allow_split_payment: bool = True
    allow_delivery: bool = True
    allow_dinein: bool = True
    allow_takeaway: bool = True
    allow_customer_display: bool = True
    allow_waiter_payment: bool = False
    kitchen_can_cancel: bool = True
    manager_pin_required_for_kitchen_cancel: bool = True
    show_prices_in_kitchen: bool = False
    show_shift_to_waiter: bool = False
    show_shift_to_kitchen: bool = False
    auto_cash_drawer: bool = True


# -------------------- APP --------------------



class ProductImageIn(BaseModel):
    image_data: str = ""

class StaffPermissionsIn(BaseModel):
    permissions: List[str] = []

class KitchenCancelIn(BaseModel):
    manager_pin: str
    reason: str = ""

class SizeIn(BaseModel):
    menu_item_id: int
    name: str
    price_delta: float = 0
    active: bool = True

class DealIn(BaseModel):
    name: str
    price: float
    rules: List[Any] = []
    active: bool = True

class KitchenStationIn(BaseModel):
    name: str
    categories: List[str] = []
    printer_id: Optional[int] = None
    active: bool = True

class ReservationIn(BaseModel):
    customer_name: str
    phone: str = ""
    table_id: Optional[int] = None
    party_size: int = 2
    reservation_at: str
    notes: str = ""

class StockTransferIn(BaseModel):
    inventory_item_id: int
    qty: float
    from_location: str = "Main"
    to_location: str = "Branch"

class FloorPositionIn(BaseModel):
    x: float
    y: float

class ReceiptLogoIn(BaseModel):
    data_url: str

class BackupRestoreIn(BaseModel):
    settings: dict = {}
    menu: list = []
    customers: list = []
    inventory: list = []
    suppliers: list = []

class PaymentTerminalChargeIn(BaseModel):
    order_id: int
    amount: float


app = FastAPI(title="MAHI POS Full Restaurant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/")
def root():
    return {"ok": True, "name": "MAHI POS Full Restaurant API"}


@app.get("/health")
def health():
    return {"ok": True}


# AUTH / STAFF
@app.post("/login")
def login(x: LoginIn):
    db = db_session()
    s = staff_by_pin(db, x.pin)
    if not s:
        db.close()
        raise HTTPException(401, "Invalid PIN")
    out = {"id": s.id, "name": s.name, "role": s.role, "permissions": json.loads(s.permissions or "[]")}
    db.close()
    return out


@app.post("/manager/verify")
def verify_manager(x: ManagerIn):
    db = db_session()
    s = manager_check(db, x.pin)
    out = {"ok": True, "id": s.id, "name": s.name}
    db.close()
    return out


@app.get("/staff")
def staff():
    db = db_session()
    rows = db.query(Staff).order_by(Staff.id).all()
    out = [{"id": x.id, "name": x.name, "role": x.role, "pin": x.pin,
            "permissions": json.loads(x.permissions or "[]"), "active": x.active} for x in rows]
    db.close()
    return out


@app.post("/staff")
def add_staff(x: StaffIn):
    db = db_session()
    if db.query(Staff).filter(Staff.pin == x.pin).first():
        db.close()
        raise HTTPException(400, "PIN already used")
    r = Staff(name=x.name, role=x.role, pin=x.pin,
              permissions=json.dumps(x.permissions), active=x.active)
    db.add(r)
    log_action(db, "create_staff", "staff", "", details=x.name)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out



@app.put("/staff/{staff_id}/permissions")
def update_staff_permissions(staff_id: int, x: StaffPermissionsIn):
    db = db_session()
    s = db.query(Staff).filter(Staff.id == staff_id).first()
    if not s:
        db.close()
        raise HTTPException(404, "Staff not found")
    s.permissions = json.dumps(x.permissions)
    log_action(db, "staff_permissions_change", "staff", staff_id, details=",".join(x.permissions))
    db.commit()
    db.close()
    return {"ok": True}

@app.post("/attendance/{staff_id}/clock-in")
def clock_in(staff_id: int):
    db = db_session()
    open_att = db.query(Attendance).filter(
        Attendance.staff_id == staff_id, Attendance.clock_out == None
    ).first()
    if open_att:
        db.close()
        return {"id": open_att.id, "already_open": True}
    a = Attendance(staff_id=staff_id)
    db.add(a)
    db.commit()
    db.refresh(a)
    out = {"id": a.id, "clock_in": a.clock_in.isoformat()}
    db.close()
    return out


@app.post("/attendance/{staff_id}/clock-out")
def clock_out(staff_id: int):
    db = db_session()
    a = db.query(Attendance).filter(
        Attendance.staff_id == staff_id, Attendance.clock_out == None
    ).order_by(Attendance.id.desc()).first()
    if not a:
        db.close()
        raise HTTPException(404, "No active attendance")
    a.clock_out = datetime.utcnow()
    db.commit()
    db.close()
    return {"ok": True}


# MENU / BARCODE / MODIFIERS
@app.get("/menu")
def menu():
    db = db_session()
    rows = db.query(MenuItem).filter(MenuItem.active == True).order_by(MenuItem.category, MenuItem.name).all()
    out = []
    for x in rows:
        mods = db.query(Modifier).filter(Modifier.menu_item_id == x.id, Modifier.active == True).all()
        out.append({
            "id": x.id, "name": x.name, "category": x.category, "price": x.price,
            "barcode": x.barcode, "sku": x.sku, "active": x.active,
            "modifiers": [{"id": m.id, "name": m.name, "price": m.price} for m in mods],
            "sizes": [{"id": s.id, "name": s.name, "price_delta": s.price_delta} for s in db.query(SizeOption).filter(SizeOption.menu_item_id == x.id, SizeOption.active == True).all()],
            "image": (db.query(ProductMedia).filter(ProductMedia.menu_item_id == x.id).first().image_data
                      if db.query(ProductMedia).filter(ProductMedia.menu_item_id == x.id).first() else "")
        })
    db.close()
    return out


@app.get("/menu/barcode/{barcode}")
def barcode_lookup(barcode: str):
    db = db_session()
    x = db.query(MenuItem).filter(MenuItem.barcode == barcode, MenuItem.active == True).first()
    if not x:
        db.close()
        raise HTTPException(404, "Barcode not found")
    out = {"id": x.id, "name": x.name, "category": x.category, "price": x.price, "barcode": x.barcode}
    db.close()
    return out


@app.get("/admin/menu")
def admin_menu():
    db = db_session()
    rows = db.query(MenuItem).order_by(MenuItem.category, MenuItem.name).all()
    out = [{"id": x.id, "name": x.name, "category": x.category, "price": x.price,
            "barcode": x.barcode, "sku": x.sku, "active": x.active,
            "sizes": [{"id": s.id, "name": s.name, "price_delta": s.price_delta, "active": s.active} for s in db.query(SizeOption).filter(SizeOption.menu_item_id == x.id).all()],
            "image": (db.query(ProductMedia).filter(ProductMedia.menu_item_id == x.id).first().image_data
                      if db.query(ProductMedia).filter(ProductMedia.menu_item_id == x.id).first() else "")} for x in rows]
    db.close()
    return out


@app.post("/admin/menu")
def add_menu(x: MenuItemIn):
    db = db_session()
    r = MenuItem(**x.model_dump())
    db.add(r)
    log_action(db, "create_menu_item", "menu", "", details=x.name)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


@app.put("/admin/menu/{item_id}")
def edit_menu(item_id: int, x: MenuItemIn):
    db = db_session()
    r = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not r:
        db.close()
        raise HTTPException(404, "Item not found")
    for k, v in x.model_dump().items():
        setattr(r, k, v)
    log_action(db, "edit_menu_item", "menu", item_id, details=x.name)
    db.commit()
    db.close()
    return {"ok": True}


@app.delete("/admin/menu/{item_id}")
def delete_menu(item_id: int):
    db = db_session()
    r = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not r:
        db.close()
        raise HTTPException(404, "Item not found")
    r.active = False
    log_action(db, "disable_menu_item", "menu", item_id, details=r.name)
    db.commit()
    db.close()
    return {"ok": True}


@app.put("/admin/menu/{item_id}/image")
def save_menu_image(item_id: int, x: ProductImageIn):
    db = db_session()
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        db.close()
        raise HTTPException(404, "Item not found")
    media = db.query(ProductMedia).filter(ProductMedia.menu_item_id == item_id).first()
    if media:
        media.image_data = x.image_data
    else:
        db.add(ProductMedia(menu_item_id=item_id, image_data=x.image_data))
    log_action(db, "menu_image_change", "menu", item_id)
    db.commit()
    db.close()
    return {"ok": True}

@app.delete("/admin/menu/{item_id}/image")
def delete_menu_image(item_id: int):
    db = db_session()
    media = db.query(ProductMedia).filter(ProductMedia.menu_item_id == item_id).first()
    if media:
        db.delete(media)
        db.commit()
    db.close()
    return {"ok": True}


@app.post("/modifiers")
def add_modifier(x: ModifierIn):
    db = db_session()
    r = Modifier(**x.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


@app.get("/modifiers/{menu_item_id}")
def modifiers(menu_item_id: int):
    db = db_session()
    rows = db.query(Modifier).filter(Modifier.menu_item_id == menu_item_id, Modifier.active == True).all()
    out = [{"id": r.id, "name": r.name, "price": r.price} for r in rows]
    db.close()
    return out


# TABLES
@app.get("/tables")
def tables():
    db = db_session()
    rows = db.query(Table).order_by(Table.id).all()
    out = [{"id": x.id, "name": x.name, "seats": x.seats, "status": x.status, "x": x.x, "y": x.y} for x in rows]
    db.close()
    return out


@app.post("/tables")
def add_table(x: TableIn):
    db = db_session()
    r = Table(**x.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


@app.post("/tables/transfer")
def transfer_table(x: TableTransferIn):
    db = db_session()
    active = db.query(Order).filter(
        Order.table_id == x.from_table_id,
        Order.status.notin_(["completed", "cancelled", "refunded"])
    ).all()
    for o in active:
        o.table_id = x.to_table_id
    old = db.query(Table).filter(Table.id == x.from_table_id).first()
    new = db.query(Table).filter(Table.id == x.to_table_id).first()
    if old: old.status = "available"
    if new: new.status = "occupied"
    db.commit()
    db.close()
    return {"ok": True, "orders_moved": len(active)}


# CUSTOMERS
@app.get("/customers")
def customers():
    db = db_session()
    rows = db.query(Customer).order_by(Customer.id.desc()).all()
    out = [{"id": x.id, "name": x.name, "phone": x.phone, "address": x.address, "points": x.points} for x in rows]
    db.close()
    return out


@app.post("/customers")
def add_customer(x: CustomerIn):
    db = db_session()
    r = Customer(**x.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


@app.get("/customers/{customer_id}/orders")
def customer_orders(customer_id: int):
    db = db_session()
    rows = db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.id.desc()).all()
    out = [order_to_dict(db, o) for o in rows]
    db.close()
    return out


# INVENTORY / RECIPES / SUPPLIERS / PURCHASE / WASTAGE
@app.get("/inventory")
def inventory():
    db = db_session()
    rows = db.query(InventoryItem).order_by(InventoryItem.name).all()
    out = [{"id": x.id, "name": x.name, "unit": x.unit, "qty": x.qty,
            "min_qty": x.min_qty, "cost": x.cost, "low": x.qty <= x.min_qty} for x in rows]
    db.close()
    return out


@app.post("/inventory")
def add_inventory(x: InventoryIn):
    db = db_session()
    r = InventoryItem(**x.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


@app.patch("/inventory/{item_id}")
def adjust_inventory(item_id: int, x: StockAdjustIn):
    db = db_session()
    r = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not r:
        db.close()
        raise HTTPException(404, "Inventory item not found")
    delta = x.qty - r.qty
    r.qty = x.qty
    db.add(StockMovement(inventory_item_id=item_id, movement_type="adjustment", qty=delta, reason=x.reason))
    db.commit()
    db.close()
    return {"ok": True}


@app.get("/inventory/movements")
def inventory_movements():
    db = db_session()
    rows = db.query(StockMovement).order_by(StockMovement.id.desc()).limit(300).all()
    out = [{"id": x.id, "inventory_item_id": x.inventory_item_id, "movement_type": x.movement_type,
            "qty": x.qty, "reason": x.reason, "created_at": x.created_at.isoformat()} for x in rows]
    db.close()
    return out


@app.get("/recipes/{menu_item_id}")
def get_recipe(menu_item_id: int):
    db = db_session()
    rows = db.query(RecipeComponent).filter(RecipeComponent.menu_item_id == menu_item_id).all()
    out = [{"id": x.id, "inventory_item_id": x.inventory_item_id, "qty": x.qty} for x in rows]
    db.close()
    return out


@app.post("/recipes/{menu_item_id}")
def add_recipe(menu_item_id: int, x: RecipeIn):
    db = db_session()
    r = RecipeComponent(menu_item_id=menu_item_id, **x.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


@app.get("/suppliers")
def suppliers():
    db = db_session()
    rows = db.query(Supplier).order_by(Supplier.name).all()
    out = [{"id": x.id, "name": x.name, "phone": x.phone, "email": x.email} for x in rows]
    db.close()
    return out


@app.post("/suppliers")
def add_supplier(x: SupplierIn):
    db = db_session()
    r = Supplier(**x.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


@app.post("/purchases")
def add_purchase(x: PurchaseIn):
    db = db_session()
    total = sum(line.qty * line.cost for line in x.items)
    p = Purchase(supplier_id=x.supplier_id, total=round(total, 2), status="received")
    db.add(p)
    db.flush()
    for line in x.items:
        db.add(PurchaseItem(
            purchase_id=p.id,
            inventory_item_id=line.inventory_item_id,
            qty=line.qty,
            cost=line.cost
        ))
        inv = db.query(InventoryItem).filter(InventoryItem.id == line.inventory_item_id).first()
        if inv:
            inv.qty += line.qty
            if line.cost > 0:
                inv.cost = line.cost
            db.add(StockMovement(
                inventory_item_id=inv.id, movement_type="purchase",
                qty=line.qty, reason=f"Purchase #{p.id}"
            ))
    db.commit()
    out = {"id": p.id, "total": p.total}
    db.close()
    return out


@app.get("/purchases")
def purchases():
    db = db_session()
    rows = db.query(Purchase).order_by(Purchase.id.desc()).all()
    out = [{"id": x.id, "supplier_id": x.supplier_id, "total": x.total,
            "status": x.status, "created_at": x.created_at.isoformat()} for x in rows]
    db.close()
    return out


@app.post("/wastage")
def wastage(x: WasteIn):
    db = db_session()
    inv = db.query(InventoryItem).filter(InventoryItem.id == x.inventory_item_id).first()
    if not inv:
        db.close()
        raise HTTPException(404, "Inventory item not found")
    inv.qty -= abs(x.qty)
    db.add(StockMovement(
        inventory_item_id=inv.id, movement_type="wastage",
        qty=-abs(x.qty), reason=x.reason
    ))
    db.commit()
    db.close()
    return {"ok": True}


# EXPENSES
@app.get("/expenses")
def expenses():
    db = db_session()
    rows = db.query(Expense).order_by(Expense.id.desc()).all()
    out = [{"id": x.id, "title": x.title, "amount": x.amount,
            "category": x.category, "created_at": x.created_at.isoformat()} for x in rows]
    db.close()
    return out


@app.post("/expenses")
def add_expense(x: ExpenseIn):
    db = db_session()
    db.add(Expense(**x.model_dump()))
    db.commit()
    db.close()
    return {"ok": True}


# SHIFTS / DAY CLOSE / CASH
@app.get("/shifts/current")
def shift_current():
    db = db_session()
    s = current_open_shift(db)
    if not s:
        db.close()
        return None
    recalc_shift(db, s)
    db.commit()
    out = {
        "id": s.id, "staff_id": s.staff_id, "status": s.status,
        "opening_cash": s.opening_cash, "cash_sales": s.cash_sales,
        "card_sales": s.card_sales, "cash_in": s.cash_in, "cash_out": s.cash_out,
        "expected_cash": s.expected_cash, "actual_cash": s.actual_cash,
        "difference": s.difference, "opened_at": s.opened_at.isoformat()
    }
    db.close()
    return out


@app.get("/shifts")
def shifts():
    db = db_session()
    rows = db.query(Shift).order_by(Shift.id.desc()).all()
    out = [{
        "id": s.id, "staff_id": s.staff_id, "status": s.status,
        "opening_cash": s.opening_cash, "cash_sales": s.cash_sales,
        "card_sales": s.card_sales, "cash_in": s.cash_in, "cash_out": s.cash_out,
        "expected_cash": s.expected_cash, "actual_cash": s.actual_cash,
        "difference": s.difference,
        "opened_at": s.opened_at.isoformat(),
        "closed_at": s.closed_at.isoformat() if s.closed_at else None
    } for s in rows]
    db.close()
    return out


@app.post("/shifts/open")
def shift_open(x: ShiftOpenIn):
    db = db_session()
    if current_open_shift(db):
        db.close()
        raise HTTPException(400, "A shift is already open")
    s = Shift(staff_id=x.staff_id, opening_cash=x.opening_cash, expected_cash=x.opening_cash, notes=x.notes)
    db.add(s)
    log_action(db, "open_shift", "shift", "", actor=x.staff_id, details=f"Opening cash {x.opening_cash}")
    db.commit()
    db.refresh(s)
    out = {"id": s.id, "opening_cash": s.opening_cash}
    db.close()
    return out


@app.post("/shifts/{shift_id}/cash")
def shift_cash(shift_id: int, x: CashMovementIn):
    if x.movement_type not in {"in", "out"}:
        raise HTTPException(400, "movement_type must be in or out")
    db = db_session()
    s = db.query(Shift).filter(Shift.id == shift_id, Shift.status == "open").first()
    if not s:
        db.close()
        raise HTTPException(404, "Open shift not found")
    db.add(CashMovement(
        shift_id=shift_id, movement_type=x.movement_type,
        amount=abs(x.amount), reason=x.reason
    ))
    db.flush()
    recalc_shift(db, s)
    db.commit()
    out = {"ok": True, "expected_cash": s.expected_cash}
    db.close()
    return out


@app.post("/shifts/{shift_id}/close")
def shift_close(shift_id: int, x: ShiftCloseIn):
    db = db_session()
    manager = manager_check(db, x.staff_pin)
    s = db.query(Shift).filter(Shift.id == shift_id, Shift.status == "open").first()
    if not s:
        db.close()
        raise HTTPException(404, "Open shift not found")

    recalc_shift(db, s)

    orders = db.query(Order).filter(
        Order.shift_id == s.id,
        Order.status.notin_(["cancelled", "held"])
    ).all()

    movements = db.query(CashMovement).filter(CashMovement.shift_id == s.id).all()

    # Expenses entered while this shift was open.
    shift_end = datetime.utcnow()
    expenses = db.query(Expense).filter(
        Expense.created_at >= s.opened_at,
        Expense.created_at <= shift_end
    ).all()

    gross_sales = round(sum(o.total for o in orders), 2)
    total_discounts = round(sum(o.discount for o in orders), 2)
    total_refunds = round(sum(o.refund_amount for o in orders), 2)
    cash_refunds = round(sum(
        o.refund_amount for o in orders if o.payment_method == "cash"
    ), 2)
    card_refunds = round(sum(
        o.refund_amount for o in orders if o.payment_method == "card"
    ), 2)
    cash_payments = round(sum(o.cash_paid for o in orders), 2)
    card_payments = round(sum(o.card_paid for o in orders), 2)
    vat_total = round(sum(o.vat for o in orders), 2)
    expenses_total = round(sum(e.amount for e in expenses), 2)

    cash_in = round(sum(m.amount for m in movements if m.movement_type == "in"), 2)
    cash_out = round(sum(m.amount for m in movements if m.movement_type == "out"), 2)

    s.actual_cash = x.actual_cash
    s.difference = round(x.actual_cash - s.expected_cash, 2)
    s.status = "closed"
    s.closed_at = shift_end
    s.notes = x.notes

    opener = db.query(Staff).filter(Staff.id == s.staff_id).first() if s.staff_id else None

    log_action(
        db, "close_shift", "shift", s.id,
        actor=manager.id,
        details=f"Difference {s.difference}"
    )
    db.commit()

    out = {
        "id": s.id,
        "staff_id": s.staff_id,
        "staff_name": opener.name if opener else "Unknown",
        "opened_at": s.opened_at.isoformat(),
        "closed_at": s.closed_at.isoformat(),

        "starting_cash": round(s.opening_cash, 2),
        "cash_payments": cash_payments,
        "cash_refunds": cash_refunds,
        "card_payments": card_payments,
        "card_refunds": card_refunds,
        "cash_in": cash_in,
        "cash_out": cash_out,

        "gross_sales": gross_sales,
        "cash_sales": round(s.cash_sales, 2),
        "card_sales": round(s.card_sales, 2),
        "discounts": total_discounts,
        "refunds": total_refunds,
        "vat": vat_total,
        "expenses": expenses_total,

        "expected_cash": round(s.expected_cash, 2),
        "actual_cash": round(s.actual_cash, 2),
        "difference": round(s.difference, 2),
        "order_count": len(orders),

        "closed_by": manager.name
    }
    db.close()
    return out


@app.post("/day-close")
def day_close(x: ManagerIn):
    db = db_session()
    manager = manager_check(db, x.pin)
    if current_open_shift(db):
        db.close()
        raise HTTPException(400, "Close the active shift first")
    today = datetime.utcnow().date().isoformat()
    existing = db.query(DayClose).filter(DayClose.business_date == today).first()
    if existing:
        db.close()
        raise HTTPException(400, "Day already closed")
    rows = [o for o in db.query(Order).all() if o.created_at.date().isoformat() == today and o.status not in {"cancelled", "held"}]
    expenses_today = [e for e in db.query(Expense).all() if e.created_at.date().isoformat() == today]
    r = DayClose(
        business_date=today, closed_by=manager.id,
        sales=round(sum(o.total - o.refund_amount for o in rows), 2),
        cash=round(sum(o.cash_paid for o in rows) - sum(o.refund_amount for o in rows if o.payment_method == "cash"), 2),
        card=round(sum(o.card_paid for o in rows) - sum(o.refund_amount for o in rows if o.payment_method == "card"), 2),
        vat=round(sum(o.vat for o in rows), 2),
        discounts=round(sum(o.discount for o in rows), 2),
        refunds=round(sum(o.refund_amount for o in rows), 2),
        expenses=round(sum(e.amount for e in expenses_today), 2)
    )
    db.add(r)
    log_action(db, "day_close", "day", today, actor=manager.id)
    db.commit()
    db.refresh(r)
    out = {"id": r.id, "business_date": today, "sales": r.sales, "cash": r.cash, "card": r.card,
           "vat": r.vat, "discounts": r.discounts, "refunds": r.refunds, "expenses": r.expenses}
    db.close()
    return out


@app.get("/day-close")
def day_closes():
    db = db_session()
    rows = db.query(DayClose).order_by(DayClose.id.desc()).all()
    out = [{"id": r.id, "business_date": r.business_date, "sales": r.sales, "cash": r.cash,
            "card": r.card, "vat": r.vat, "discounts": r.discounts,
            "refunds": r.refunds, "expenses": r.expenses, "created_at": r.created_at.isoformat()} for r in rows]
    db.close()
    return out


# COUPONS
@app.get("/coupons")
def coupons():
    db = db_session()
    rows = db.query(Coupon).order_by(Coupon.id.desc()).all()
    out = [{"id": r.id, "code": r.code, "discount_type": r.discount_type, "value": r.value, "active": r.active} for r in rows]
    db.close()
    return out


@app.post("/coupons")
def add_coupon(x: CouponIn):
    db = db_session()
    if db.query(Coupon).filter(Coupon.code == x.code).first():
        db.close()
        raise HTTPException(400, "Coupon already exists")
    r = Coupon(code=x.code.upper().strip(), discount_type=x.discount_type, value=x.value, active=x.active)
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


# ORDERS
@app.post("/orders")
def add_order(x: OrderIn):
    db = db_session()
    if not flag(db, "app_enabled", True):
        db.close()
        raise HTTPException(403, "POS app is disabled by Admin")
    if not flag(db, "shop_open", True):
        db.close()
        raise HTTPException(403, "Shop is closed by Admin")
    if x.order_type == "delivery" and not flag(db, "allow_delivery", True):
        db.close()
        raise HTTPException(403, "Delivery is disabled")
    if x.order_type == "dinein":
        db.close()
        raise HTTPException(403, "Dine-in/Table ordering is disabled")
    if x.order_type == "takeaway" and not flag(db, "allow_takeaway", True):
        db.close()
        raise HTTPException(403, "Takeaway is disabled")
    if x.discount > 0 and not flag(db, "allow_discounts", True):
        db.close()
        raise HTTPException(403, "Discounts are disabled")
    if x.coupon_code and not flag(db, "allow_coupons", True):
        db.close()
        raise HTTPException(403, "Coupons are disabled")
    if x.hold and not flag(db, "allow_hold_orders", True):
        db.close()
        raise HTTPException(403, "Hold orders are disabled")
    if x.payment_method == "split" and not flag(db, "allow_split_payment", True):
        db.close()
        raise HTTPException(403, "Split payment is disabled")

    require_shift = get_setting(db, "require_shift", "true").lower() == "true"
    shift = db.query(Shift).filter(Shift.id == x.shift_id, Shift.status == "open").first() if x.shift_id else current_open_shift(db)
    if require_shift and not shift:
        db.close()
        raise HTTPException(400, "Open shift first")

    subtotal = 0.0
    selected = []
    for ci in x.items:
        m = db.query(MenuItem).filter(MenuItem.id == ci.menu_item_id, MenuItem.active == True).first()
        if not m:
            db.close()
            raise HTTPException(400, f"Invalid menu item {ci.menu_item_id}")
        qty = max(1, ci.qty)
        size = None
        size_delta = 0.0
        if ci.size_id:
            size = db.query(SizeOption).filter(SizeOption.id == ci.size_id, SizeOption.menu_item_id == m.id, SizeOption.active == True).first()
            if not size:
                db.close()
                raise HTTPException(400, "Invalid size")
            size_delta = float(size.price_delta or 0)
        mods = []
        mods_total = 0.0
        if ci.modifier_ids:
            mod_rows = db.query(Modifier).filter(Modifier.id.in_(ci.modifier_ids), Modifier.active == True).all()
            mods = [{"id": mod.id, "name": mod.name, "price": mod.price} for mod in mod_rows]
            mods_total = sum(mod.price for mod in mod_rows)
        unit_price = m.price + size_delta + mods_total
        subtotal += unit_price * qty
        selected.append((m, qty, ci.notes, mods, unit_price, size))

    discount = max(0, min(x.discount, subtotal))
    coupon_code = x.coupon_code.strip().upper()
    if coupon_code:
        c = db.query(Coupon).filter(Coupon.code == coupon_code, Coupon.active == True).first()
        if c:
            coupon_discount = c.value if c.discount_type == "fixed" else subtotal * (c.value / 100)
            discount = min(subtotal, discount + coupon_discount)

    gross_after_discount = subtotal - discount
    vat_percent = float(get_setting(db, "vat_percent", "5")) if flag(db, "vat_enabled", True) else 0
    vat_inclusive = flag(db, "vat_inclusive", True)

    if vat_percent > 0 and vat_inclusive:
        # Menu price is the final VAT-inclusive selling price.
        total = round(gross_after_discount, 2)
        vat = round(total - (total / (1 + vat_percent / 100)), 2)
        taxable = round(total - vat, 2)
    else:
        taxable = round(gross_after_discount, 2)
        vat = round(taxable * vat_percent / 100, 2)
        total = round(taxable + vat, 2)

    cash_paid = float(x.cash_paid or 0)
    card_paid = float(x.card_paid or 0)
    if x.payment_method == "cash" and cash_paid == 0:
        cash_paid = total
    elif x.payment_method == "card" and card_paid == 0:
        card_paid = total
    elif x.payment_method == "split":
        if round(cash_paid + card_paid, 2) != total:
            db.close()
            raise HTTPException(400, "Split payment must equal order total")

    status = "held" if x.hold else "new"
    o = Order(
        order_type=x.order_type, table_id=x.table_id, waiter_id=x.waiter_id,
        customer_id=x.customer_id, shift_id=shift.id if shift else None,
        payment_method=x.payment_method, cash_paid=cash_paid, card_paid=card_paid,
        subtotal=round(subtotal, 2), discount=round(discount, 2), vat=vat, total=total,
        coupon_code=coupon_code, delivery_address=x.delivery_address, status=status, notes=x.notes
    )
    for m, qty, note, mods, unit_price, size in selected:
        display_name = f"{m.name} - {size.name}" if size else m.name
        o.items.append(OrderItem(
            menu_item_id=m.id, name=display_name, qty=qty, unit_price=unit_price,
            modifiers=json.dumps(mods), notes=note
        ))
    db.add(o)
    if x.table_id and not x.hold:
        table = db.query(Table).filter(Table.id == x.table_id).first()
        if table:
            table.status = "occupied"
    db.flush()
    if not x.hold:
        stock_apply_for_order(db, o, direction=-1)
    if x.customer_id:
        customer = db.query(Customer).filter(Customer.id == x.customer_id).first()
        if customer:
            customer.points += total
    log_action(db, "create_order" if not x.hold else "hold_order", "order", o.id)
    if shift:
        recalc_shift(db, shift)
    db.commit()
    db.refresh(o)
    out = order_to_dict(db, o)
    db.close()
    return out


@app.get("/orders")
def orders(status: Optional[str] = None):
    db = db_session()
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    rows = q.order_by(Order.id.desc()).all()
    out = [order_to_dict(db, o) for o in rows]
    db.close()
    return out


@app.get("/orders/held/list")
def held_orders():
    db = db_session()
    rows = db.query(Order).filter(Order.status == "held").order_by(Order.id.desc()).all()
    out = [order_to_dict(db, o) for o in rows]
    db.close()
    return out


@app.get("/orders/{order_id}")
def order_detail(order_id: int):
    db = db_session()
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        db.close()
        raise HTTPException(404, "Order not found")
    out = order_to_dict(db, o)
    out["settings"] = {k: get_setting(db, k, "") for k in [
        "shop_name", "shop_phone", "shop_address", "trn", "vat_percent", "receipt_footer"
    ]}
    db.close()
    return out


@app.post("/orders/{order_id}/recall")
def recall_order(order_id: int):
    db = db_session()
    o = db.query(Order).filter(Order.id == order_id, Order.status == "held").first()
    if not o:
        db.close()
        raise HTTPException(404, "Held order not found")
    o.status = "new"
    stock_apply_for_order(db, o, direction=-1)
    if o.table_id:
        t = db.query(Table).filter(Table.id == o.table_id).first()
        if t: t.status = "occupied"
    log_action(db, "recall_order", "order", order_id)
    db.commit()
    db.close()
    return {"ok": True}


@app.patch("/orders/{order_id}/status/{status}")
def set_status(order_id: int, status: str):
    allowed = {"new", "preparing", "ready", "completed", "cancelled", "held", "refunded"}
    if status not in allowed:
        raise HTTPException(400, "Invalid status")
    db = db_session()
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        db.close()
        raise HTTPException(404, "Order not found")
    o.status = status
    if status in {"completed", "cancelled", "refunded"} and o.table_id:
        t = db.query(Table).filter(Table.id == o.table_id).first()
        if t: t.status = "available"
    db.commit()
    db.close()
    return {"ok": True}



@app.post("/orders/{order_id}/kitchen-cancel")
def kitchen_cancel(order_id: int, x: KitchenCancelIn):
    db = db_session()
    if not flag(db, "kitchen_can_cancel", True):
        db.close()
        raise HTTPException(403, "Kitchen cancellation is disabled")
    manager = manager_check(db, x.manager_pin)
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        db.close()
        raise HTTPException(404, "Order not found")
    if o.status in {"completed", "cancelled", "refunded"}:
        db.close()
        raise HTTPException(400, "Order cannot be cancelled")
    stock_apply_for_order(db, o, direction=1)
    o.status = "cancelled"
    if o.table_id:
        t = db.query(Table).filter(Table.id == o.table_id).first()
        if t: t.status = "available"
    log_action(db, "kitchen_cancel_order", "order", order_id, actor=manager.id, details=x.reason)
    shift = db.query(Shift).filter(Shift.id == o.shift_id).first() if o.shift_id else None
    recalc_shift(db, shift)
    db.commit()
    db.close()
    return {"ok": True}

@app.post("/orders/{order_id}/split-payment")
def split_payment(order_id: int, x: SplitPaymentIn):
    db = db_session()
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        db.close()
        raise HTTPException(404, "Order not found")
    if round(x.cash + x.card, 2) != round(o.total - o.refund_amount, 2):
        db.close()
        raise HTTPException(400, "Split payment must equal payable total")
    o.payment_method = "split"
    o.cash_paid = x.cash
    o.card_paid = x.card
    shift = db.query(Shift).filter(Shift.id == o.shift_id).first() if o.shift_id else None
    recalc_shift(db, shift)
    db.commit()
    db.close()
    return {"ok": True}


@app.post("/orders/{order_id}/void")
def void_order(order_id: int, x: VoidIn):
    db = db_session()
    if not flag(db, "allow_voids", True):
        db.close()
        raise HTTPException(403, "Void is disabled by Admin")
    manager = manager_check(db, x.manager_pin)
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        db.close()
        raise HTTPException(404, "Order not found")
    if o.status not in {"cancelled", "held"}:
        stock_apply_for_order(db, o, direction=1)
    o.status = "cancelled"
    if o.table_id:
        t = db.query(Table).filter(Table.id == o.table_id).first()
        if t: t.status = "available"
    log_action(db, "void_order", "order", order_id, actor=manager.id, details=x.reason)
    shift = db.query(Shift).filter(Shift.id == o.shift_id).first() if o.shift_id else None
    recalc_shift(db, shift)
    db.commit()
    db.close()
    return {"ok": True}


@app.post("/orders/{order_id}/refund")
def refund_order(order_id: int, x: RefundIn):
    db = db_session()
    if not flag(db, "allow_refunds", True):
        db.close()
        raise HTTPException(403, "Refunds are disabled by Admin")
    manager = manager_check(db, x.manager_pin)
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        db.close()
        raise HTTPException(404, "Order not found")
    amount = round(x.amount if x.amount is not None else (o.total - o.refund_amount), 2)
    if amount <= 0 or o.refund_amount + amount > o.total:
        db.close()
        raise HTTPException(400, "Invalid refund amount")
    o.refund_amount = round(o.refund_amount + amount, 2)
    if o.refund_amount >= o.total:
        o.status = "refunded"
        stock_apply_for_order(db, o, direction=1)
        if o.table_id:
            t = db.query(Table).filter(Table.id == o.table_id).first()
            if t: t.status = "available"
    log_action(db, "refund_order", "order", order_id, actor=manager.id, details=f"{amount}: {x.reason}")
    shift = db.query(Shift).filter(Shift.id == o.shift_id).first() if o.shift_id else None
    recalc_shift(db, shift)
    db.commit()
    out = {"ok": True, "refund_amount": o.refund_amount, "status": o.status}
    db.close()
    return out


# PRINTERS
@app.get("/printers")
def printers():
    db = db_session()
    rows = db.query(Printer).order_by(Printer.id).all()
    out = [{"id": r.id, "name": r.name, "role": r.role, "ip": r.ip, "port": r.port,
            "auto_print": r.auto_print, "categories": json.loads(r.categories or "[]")} for r in rows]
    db.close()
    return out


@app.post("/printers")
def add_printer(x: PrinterIn):
    db = db_session()
    r = Printer(name=x.name, role=x.role, ip=x.ip, port=x.port,
                auto_print=x.auto_print, categories=json.dumps(x.categories))
    db.add(r)
    db.commit()
    db.refresh(r)
    out = {"id": r.id}
    db.close()
    return out


# SETTINGS
@app.get("/settings")
def settings():
    db = db_session()
    keys = [
        "shop_name", "shop_phone", "shop_address", "trn", "vat_percent",
        "receipt_footer", "printer_ip", "printer_port", "auto_print",
        "kitchen_sound", "require_shift", "currency",
        "payment_terminal_provider", "payment_terminal_enabled",
        "customer_display_enabled", "offline_queue_enabled", "receipt_logo",
        "app_enabled", "shop_open", "vat_enabled", "vat_inclusive", "allow_discounts", "allow_coupons", "allow_refunds", "allow_voids", "allow_hold_orders", "allow_split_payment", "allow_delivery", "allow_dinein", "allow_takeaway", "allow_customer_display", "allow_waiter_payment", "kitchen_can_cancel", "manager_pin_required_for_kitchen_cancel", "show_prices_in_kitchen", "show_shift_to_waiter", "show_shift_to_kitchen", "auto_cash_drawer"
    ]
    d = {k: get_setting(db, k, "") for k in keys}
    d["vat_percent"] = float(d["vat_percent"] or 5)
    d["printer_port"] = int(d["printer_port"] or 9100)
    d["business_timezone_offset_minutes"] = int(d.get("business_timezone_offset_minutes") or 240)
    for k in ["auto_print", "kitchen_sound", "require_shift", "payment_terminal_enabled", "customer_display_enabled", "offline_queue_enabled", "app_enabled", "shop_open", "vat_enabled", "vat_inclusive", "allow_discounts", "allow_coupons", "allow_refunds", "allow_voids", "allow_hold_orders", "allow_split_payment", "allow_delivery", "allow_dinein", "allow_takeaway", "allow_customer_display", "allow_waiter_payment", "kitchen_can_cancel", "manager_pin_required_for_kitchen_cancel", "show_prices_in_kitchen", "show_shift_to_waiter", "show_shift_to_kitchen", "auto_cash_drawer"]:
        d[k] = str(d[k]).lower() == "true"
    db.close()
    return d


@app.put("/settings")
def save_settings(x: SettingsIn):
    db = db_session()
    for k, v in x.model_dump().items():
        put_setting(db, k, str(v).lower() if isinstance(v, bool) else v)
    db.commit()
    db.close()
    return {"ok": True}



# SIZES / DEALS
@app.get("/sizes/{menu_item_id}")
def get_sizes(menu_item_id: int):
    db = db_session()
    rows = db.query(SizeOption).filter(SizeOption.menu_item_id == menu_item_id, SizeOption.active == True).all()
    out = [{"id": r.id, "menu_item_id": r.menu_item_id, "name": r.name, "price_delta": r.price_delta, "active": r.active} for r in rows]
    db.close()
    return out

@app.post("/sizes")
def add_size(x: SizeIn):
    db = db_session()
    r = SizeOption(**x.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    out={"id":r.id}; db.close(); return out

@app.delete("/sizes/{size_id}")
def delete_size(size_id: int):
    db = db_session()
    r = db.query(SizeOption).filter(SizeOption.id == size_id).first()
    if not r:
        db.close(); raise HTTPException(404, "Size not found")
    r.active = False
    db.commit(); db.close()
    return {"ok": True}

@app.get("/deals")
def get_deals():
    db=db_session()
    rows=db.query(Deal).filter(Deal.active==True).order_by(Deal.id.desc()).all()
    out=[{"id":r.id,"name":r.name,"price":r.price,"active":r.active,"rules":json.loads(r.rules or "[]")} for r in rows]
    db.close(); return out

@app.post("/deals")
def add_deal(x: DealIn):
    db=db_session()
    r=Deal(name=x.name,price=x.price,active=x.active,rules=json.dumps(x.rules))
    db.add(r);db.commit();db.refresh(r);out={"id":r.id};db.close();return out

# FLOOR PLAN
@app.patch("/tables/{table_id}/position")
def table_position(table_id:int,x:FloorPositionIn):
    db=db_session();t=db.query(Table).filter(Table.id==table_id).first()
    if not t: db.close(); raise HTTPException(404,"Table not found")
    t.x=x.x;t.y=x.y;db.commit();db.close();return {"ok":True}

# KITCHEN STATIONS / ROUTING
@app.get("/kitchen-stations")
def kitchen_stations():
    db=db_session();rows=db.query(KitchenStation).order_by(KitchenStation.id).all()
    out=[{"id":r.id,"name":r.name,"categories":json.loads(r.categories or "[]"),"printer_id":r.printer_id,"active":r.active} for r in rows]
    db.close();return out

@app.post("/kitchen-stations")
def add_kitchen_station(x:KitchenStationIn):
    db=db_session();r=KitchenStation(name=x.name,categories=json.dumps(x.categories),printer_id=x.printer_id,active=x.active)
    db.add(r);db.commit();db.refresh(r);out={"id":r.id};db.close();return out

@app.get("/kitchen-stations/{station_id}/orders")
def station_orders(station_id:int):
    db=db_session();s=db.query(KitchenStation).filter(KitchenStation.id==station_id).first()
    if not s: db.close(); raise HTTPException(404,"Station not found")
    cats=set(json.loads(s.categories or "[]"));result=[]
    for o in db.query(Order).filter(Order.status.in_(["new","preparing","ready"])).order_by(Order.id.desc()).all():
        filtered=[]
        for i in o.items:
            m=db.query(MenuItem).filter(MenuItem.id==i.menu_item_id).first()
            if not cats or (m and m.category in cats):
                filtered.append({"name":i.name,"qty":i.qty,"unit_price":i.unit_price,"notes":i.notes})
        if filtered:
            d=order_to_dict(db,o);d["items"]=filtered;result.append(d)
    db.close();return result

# RESERVATIONS
@app.get("/reservations")
def reservations():
    db=db_session();rows=db.query(Reservation).order_by(Reservation.reservation_at).all()
    out=[{"id":r.id,"customer_name":r.customer_name,"phone":r.phone,"table_id":r.table_id,"party_size":r.party_size,
          "reservation_at":r.reservation_at.isoformat(),"status":r.status,"notes":r.notes} for r in rows]
    db.close();return out

@app.post("/reservations")
def add_reservation(x:ReservationIn):
    db=db_session()
    try: dt=datetime.fromisoformat(x.reservation_at)
    except: db.close(); raise HTTPException(400,"reservation_at must be ISO date/time")
    r=Reservation(customer_name=x.customer_name,phone=x.phone,table_id=x.table_id,party_size=x.party_size,
                  reservation_at=dt,notes=x.notes,status="booked")
    db.add(r);db.commit();db.refresh(r);out={"id":r.id};db.close();return out

@app.patch("/reservations/{reservation_id}/{status}")
def reservation_status(reservation_id:int,status:str):
    if status not in {"booked","seated","completed","cancelled","no-show"}: raise HTTPException(400,"Invalid status")
    db=db_session();r=db.query(Reservation).filter(Reservation.id==reservation_id).first()
    if not r: db.close(); raise HTTPException(404,"Reservation not found")
    r.status=status;db.commit();db.close();return {"ok":True}

# STOCK TRANSFER
@app.post("/stock-transfer")
def stock_transfer(x:StockTransferIn):
    db=db_session();inv=db.query(InventoryItem).filter(InventoryItem.id==x.inventory_item_id).first()
    if not inv: db.close(); raise HTTPException(404,"Inventory item not found")
    if x.qty<=0 or inv.qty<x.qty: db.close(); raise HTTPException(400,"Insufficient stock")
    inv.qty-=x.qty
    tr=StockTransfer(inventory_item_id=x.inventory_item_id,qty=x.qty,from_location=x.from_location,to_location=x.to_location)
    db.add(tr);db.add(StockMovement(inventory_item_id=inv.id,movement_type="transfer",qty=-x.qty,reason=f"{x.from_location} -> {x.to_location}"))
    db.commit();db.refresh(tr);out={"id":tr.id};db.close();return out

@app.get("/stock-transfer")
def stock_transfers():
    db=db_session();rows=db.query(StockTransfer).order_by(StockTransfer.id.desc()).all()
    out=[{"id":r.id,"inventory_item_id":r.inventory_item_id,"qty":r.qty,"from_location":r.from_location,"to_location":r.to_location,"status":r.status,"created_at":r.created_at.isoformat()} for r in rows]
    db.close();return out

# FOOD COST
@app.get("/food-cost")
def food_cost():
    db=db_session();out=[]
    for m in db.query(MenuItem).filter(MenuItem.active==True).all():
        total=0.0
        for c in db.query(RecipeComponent).filter(RecipeComponent.menu_item_id==m.id).all():
            inv=db.query(InventoryItem).filter(InventoryItem.id==c.inventory_item_id).first()
            if inv: total += c.qty*inv.cost
        pct=(total/m.price*100) if m.price else 0
        out.append({"menu_item_id":m.id,"name":m.name,"selling_price":m.price,"ingredient_cost":round(total,2),"food_cost_percent":round(pct,2)})
    db.close();return out

# CUSTOMER DISPLAY
@app.get("/customer-display/current")
def customer_display_current():
    db=db_session()
    o=db.query(Order).filter(Order.status.in_(["new","preparing","ready"])).order_by(Order.id.desc()).first()
    out=order_to_dict(db,o) if o else None
    db.close();return out

# RECEIPT LOGO
@app.put("/receipt-logo")
def save_receipt_logo(x:ReceiptLogoIn):
    db=db_session();put_setting(db,"receipt_logo",x.data_url);db.commit();db.close();return {"ok":True}

@app.get("/receipt-logo")
def receipt_logo():
    db=db_session();v=get_setting(db,"receipt_logo","");db.close();return {"data_url":v}

# BACKUP RESTORE
@app.post("/backup/restore")
def backup_restore(x:BackupRestoreIn):
    db=db_session()
    for k,v in x.settings.items(): put_setting(db,k,v)
    for item in x.menu:
        name=str(item.get("name","")).strip()
        if not name: continue
        db.add(MenuItem(name=name,category=item.get("category","General"),price=float(item.get("price",0)),
                        barcode=item.get("barcode",""),sku=item.get("sku",""),active=bool(item.get("active",True))))
    for c in x.customers:
        name=str(c.get("name","")).strip()
        if name: db.add(Customer(name=name,phone=c.get("phone",""),address=c.get("address",""),points=float(c.get("points",0))))
    for i in x.inventory:
        name=str(i.get("name","")).strip()
        if name: db.add(InventoryItem(name=name,unit=i.get("unit","pcs"),qty=float(i.get("qty",0)),
                                      min_qty=float(i.get("min_qty",0)),cost=float(i.get("cost",0))))
    for s in x.suppliers:
        name=str(s.get("name","")).strip()
        if name: db.add(Supplier(name=name,phone=s.get("phone",""),email=s.get("email","")))
    log_action(db,"backup_restore","system","")
    db.commit();db.close();return {"ok":True}

# GENERIC PAYMENT TERMINAL GATEWAY PLACEHOLDER
@app.post("/payment-terminal/charge")
def payment_terminal_charge(x:PaymentTerminalChargeIn):
    db=db_session()
    enabled=get_setting(db,"payment_terminal_enabled","false").lower()=="true"
    provider=get_setting(db,"payment_terminal_provider","").strip()
    db.close()
    if not enabled or not provider:
        raise HTTPException(400,"Payment terminal provider is not configured")
    return {"ok":False,"provider":provider,"status":"integration_required",
            "message":"Add the selected provider's official SDK/API credentials to complete real terminal charging."}



def _business_local_dt(db, dt):
    offset = int(get_setting(db, "business_timezone_offset_minutes", "240"))
    return dt + timedelta(minutes=offset)

def _hhmm_minutes(value: str):
    try:
        h, m = value.split(":")
        return int(h) * 60 + int(m)
    except:
        return 0

def _in_time_window(local_dt, start_hhmm: str, end_hhmm: str):
    minute = local_dt.hour * 60 + local_dt.minute
    start = _hhmm_minutes(start_hhmm)
    end = _hhmm_minutes(end_hhmm)
    if start == end:
        return True
    if start < end:
        return start <= minute < end
    # Overnight window, e.g. 16:00 -> 01:00
    return minute >= start or minute < end

def _business_date_for_window(local_dt, start_hhmm: str, end_hhmm: str):
    # For overnight periods, after-midnight sales belong to the previous business date.
    start = _hhmm_minutes(start_hhmm)
    end = _hhmm_minutes(end_hhmm)
    minute = local_dt.hour * 60 + local_dt.minute
    d = local_dt.date()
    if start > end and minute < end:
        d = d - timedelta(days=1)
    return d

def _sales_bucket(rows):
    valid = [o for o in rows if o.status not in {"cancelled", "held"}]
    return {
        "orders": len(valid),
        "gross_sales": round(sum(max(0, o.total - o.refund_amount) for o in valid), 2),
        "cash": round(sum(max(0, o.cash_paid) for o in valid) - sum(o.refund_amount for o in valid if o.payment_method == "cash"), 2),
        "card": round(sum(max(0, o.card_paid) for o in valid) - sum(o.refund_amount for o in valid if o.payment_method == "card"), 2),
        "vat": round(sum(max(0, o.vat) for o in valid), 2),
        "refunds": round(sum(max(0, o.refund_amount) for o in valid), 2),
        "discounts": round(sum(max(0, o.discount) for o in valid), 2),
    }

@app.get("/reports/day-parts")
def day_parts_report(business_date: Optional[str] = None):
    db = db_session()
    offset = int(get_setting(db, "business_timezone_offset_minutes", "240"))
    now_local = datetime.utcnow() + timedelta(minutes=offset)
    try:
        target_date = datetime.strptime(business_date, "%Y-%m-%d").date() if business_date else now_local.date()
    except:
        db.close()
        raise HTTPException(400, "business_date must be YYYY-MM-DD")

    ml = get_setting(db, "morning_sales_label", "Morning")
    ms = get_setting(db, "morning_sales_start", "08:00")
    me = get_setting(db, "morning_sales_end", "16:00")
    el = get_setting(db, "evening_sales_label", "Evening")
    es = get_setting(db, "evening_sales_start", "16:00")
    ee = get_setting(db, "evening_sales_end", "01:00")

    all_orders = db.query(Order).all()
    morning_rows = []
    evening_rows = []
    full_day_rows = []

    for o in all_orders:
        local_dt = _business_local_dt(db, o.created_at)

        # Full business date: morning/date plus overnight tail that belongs to the target day.
        local_date = local_dt.date()
        ev_business_date = _business_date_for_window(local_dt, es, ee)
        if local_date == target_date or (ev_business_date == target_date and _in_time_window(local_dt, es, ee)):
            full_day_rows.append(o)

        if local_dt.date() == target_date and _in_time_window(local_dt, ms, me):
            morning_rows.append(o)

        if _in_time_window(local_dt, es, ee) and _business_date_for_window(local_dt, es, ee) == target_date:
            evening_rows.append(o)

    out = {
        "business_date": target_date.isoformat(),
        "timezone_offset_minutes": offset,
        "morning": {"label": ml, "start": ms, "end": me, **_sales_bucket(morning_rows)},
        "evening": {"label": el, "start": es, "end": ee, **_sales_bucket(evening_rows)},
        "full_day": _sales_bucket(full_day_rows),
    }
    db.close()
    return out


# REPORTS / AUDIT / BACKUP
def report_between(db, start: date, end: date):
    os_ = [o for o in db.query(Order).all() if start <= o.created_at.date() <= end and o.status not in {"cancelled", "held"}]
    es = [e for e in db.query(Expense).all() if start <= e.created_at.date() <= end]
    sales = round(sum(o.total - o.refund_amount for o in os_), 2)
    cash = round(sum(o.cash_paid for o in os_) - sum(o.refund_amount for o in os_ if o.payment_method == "cash"), 2)
    card = round(sum(o.card_paid for o in os_) - sum(o.refund_amount for o in os_ if o.payment_method == "card"), 2)
    vat = round(sum(o.vat for o in os_), 2)
    discounts = round(sum(o.discount for o in os_), 2)
    refunds = round(sum(o.refund_amount for o in os_), 2)
    expenses = round(sum(e.amount for e in es), 2)
    return {
        "orders": len(os_), "sales": sales, "cash": cash, "card": card,
        "vat": vat, "discounts": discounts, "refunds": refunds,
        "expenses": expenses, "net_after_expenses": round(sales - expenses, 2)
    }



@app.get("/reports/uae-vat")
def uae_vat_report(start: Optional[str] = None, end: Optional[str] = None):
    db = db_session()
    try:
        s = datetime.strptime(start, "%Y-%m-%d").date() if start else datetime.utcnow().date().replace(day=1)
        e = datetime.strptime(end, "%Y-%m-%d").date() if end else datetime.utcnow().date()
    except:
        db.close()
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    rows = [
        o for o in db.query(Order).all()
        if s <= o.created_at.date() <= e and o.status not in {"cancelled", "held"}
    ]
    gross_sales = round(sum(max(0, o.total - o.refund_amount) for o in rows), 2)

    # Output VAT from each stored order. Stored VAT is already extracted correctly
    # from VAT-inclusive prices when vat_inclusive is enabled.
    output_vat = round(sum(max(0, o.vat) for o in rows), 2)
    sales_ex_vat = round(gross_sales - output_vat, 2)
    refunds = round(sum(o.refund_amount for o in rows), 2)

    # Expenses currently store gross expense amounts only. Input VAT can only be
    # reclaimed when supported by valid tax invoices, so this report does not
    # invent recoverable input VAT.
    expense_total = round(sum(
        x.amount for x in db.query(Expense).all()
        if s <= x.created_at.date() <= e
    ), 2)

    out = {
        "period_start": s.isoformat(),
        "period_end": e.isoformat(),
        "standard_rated_sales_including_vat": gross_sales,
        "standard_rated_sales_excluding_vat": sales_ex_vat,
        "output_vat_collected": output_vat,
        "refunds": refunds,
        "expenses_total": expense_total,
        "recoverable_input_vat": None,
        "net_vat_before_input_tax": output_vat,
        "note": "Recoverable input VAT must be entered from valid supplier tax invoices; it is not auto-assumed from expenses."
    }
    db.close()
    return out


@app.get("/reports/today")
def reports_today():
    db = db_session()
    today = datetime.utcnow().date()
    out = report_between(db, today, today)
    db.close()
    return out


@app.get("/reports")
def reports(start: str, end: str):
    db = db_session()
    try:
        s = datetime.strptime(start, "%Y-%m-%d").date()
        e = datetime.strptime(end, "%Y-%m-%d").date()
    except:
        db.close()
        raise HTTPException(400, "Dates must be YYYY-MM-DD")
    out = report_between(db, s, e)

    item_sales = {}
    category_sales = {}
    waiter_sales = {}
    for o in db.query(Order).all():
        if not (s <= o.created_at.date() <= e) or o.status in {"cancelled", "held"}:
            continue
        waiter_sales[str(o.waiter_id or "none")] = waiter_sales.get(str(o.waiter_id or "none"), 0) + (o.total - o.refund_amount)
        for i in o.items:
            item_sales[i.name] = item_sales.get(i.name, 0) + i.qty
            m = db.query(MenuItem).filter(MenuItem.id == i.menu_item_id).first()
            cat = m.category if m else "Unknown"
            category_sales[cat] = category_sales.get(cat, 0) + (i.qty * i.unit_price)

    out["top_items"] = sorted(
        [{"name": k, "qty": v} for k, v in item_sales.items()],
        key=lambda x: x["qty"], reverse=True
    )[:20]
    out["categories"] = [{"name": k, "sales": round(v, 2)} for k, v in category_sales.items()]
    out["waiters"] = [{"staff_id": k, "sales": round(v, 2)} for k, v in waiter_sales.items()]
    db.close()
    return out


@app.get("/audit")
def audit():
    db = db_session()
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(500).all()
    out = [{"id": r.id, "actor_staff_id": r.actor_staff_id, "action": r.action,
            "entity": r.entity, "entity_id": r.entity_id, "details": r.details,
            "created_at": r.created_at.isoformat()} for r in rows]
    db.close()
    return out


@app.get("/backup/export")
def backup_export():
    db = db_session()
    out = {
        "exported_at": datetime.utcnow().isoformat(),
        "settings": {r.key: r.value for r in db.query(Setting).all()},
        "menu": [{"name": r.name, "category": r.category, "price": r.price,
                  "barcode": r.barcode, "sku": r.sku, "active": r.active} for r in db.query(MenuItem).all()],
        "customers": [{"name": r.name, "phone": r.phone, "address": r.address, "points": r.points} for r in db.query(Customer).all()],
        "inventory": [{"name": r.name, "unit": r.unit, "qty": r.qty, "min_qty": r.min_qty, "cost": r.cost} for r in db.query(InventoryItem).all()],
        "suppliers": [{"name": r.name, "phone": r.phone, "email": r.email} for r in db.query(Supplier).all()],
        "orders": [order_to_dict(db, o) for o in db.query(Order).order_by(Order.id).all()]
    }
    db.close()
    return out

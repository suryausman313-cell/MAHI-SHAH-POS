from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

engine = create_engine('sqlite:///./pos.db', connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Setting(Base):
    __tablename__='settings'; id=Column(Integer,primary_key=True); key=Column(String,unique=True); value=Column(Text,default='')
class MenuItem(Base):
    __tablename__='menu_items'; id=Column(Integer,primary_key=True); name=Column(String,nullable=False); category=Column(String,default='General'); price=Column(Float,nullable=False); active=Column(Boolean,default=True)
class Table(Base):
    __tablename__='tables'; id=Column(Integer,primary_key=True); name=Column(String,nullable=False); seats=Column(Integer,default=4); status=Column(String,default='available')
class Staff(Base):
    __tablename__='staff'; id=Column(Integer,primary_key=True); name=Column(String,nullable=False); role=Column(String,default='cashier'); pin=Column(String,default='1234'); active=Column(Boolean,default=True)
class InventoryItem(Base):
    __tablename__='inventory_items'; id=Column(Integer,primary_key=True); name=Column(String,nullable=False); unit=Column(String,default='pcs'); qty=Column(Float,default=0); min_qty=Column(Float,default=0); cost=Column(Float,default=0)
class Expense(Base):
    __tablename__='expenses'; id=Column(Integer,primary_key=True); title=Column(String,nullable=False); amount=Column(Float,default=0); created_at=Column(DateTime,default=datetime.utcnow)
class Order(Base):
    __tablename__='orders'; id=Column(Integer,primary_key=True); order_type=Column(String,default='takeaway'); table_id=Column(Integer,nullable=True); waiter_id=Column(Integer,nullable=True); status=Column(String,default='new'); payment_method=Column(String,default='cash'); subtotal=Column(Float,default=0); discount=Column(Float,default=0); vat=Column(Float,default=0); total=Column(Float,default=0); notes=Column(Text,default=''); created_at=Column(DateTime,default=datetime.utcnow); items=relationship('OrderItem',cascade='all, delete-orphan')
class OrderItem(Base):
    __tablename__='order_items'; id=Column(Integer,primary_key=True); order_id=Column(Integer,ForeignKey('orders.id')); menu_item_id=Column(Integer); name=Column(String); qty=Column(Integer,default=1); unit_price=Column(Float); notes=Column(Text,default='')
Base.metadata.create_all(bind=engine)

def get_setting(db,key,default):
    r=db.query(Setting).filter(Setting.key==key).first(); return r.value if r else default

def put_setting(db,key,value):
    r=db.query(Setting).filter(Setting.key==key).first()
    if r: r.value=str(value)
    else: db.add(Setting(key=key,value=str(value)))

def seed():
    db=SessionLocal()
    if db.query(MenuItem).count()==0:
        db.add_all([MenuItem(name='Margherita Pizza',category='Pizza',price=25),MenuItem(name='Pepperoni Pizza',category='Pizza',price=30),MenuItem(name='Chicken Burger',category='Burger',price=18),MenuItem(name='French Fries',category='Sides',price=10),MenuItem(name='Cola',category='Drinks',price=5)])
    if db.query(Table).count()==0: db.add_all([Table(name=f'Table {i}',seats=4) for i in range(1,9)])
    if db.query(Staff).count()==0: db.add_all([Staff(name='Admin',role='admin',pin='1111'),Staff(name='Cashier',role='cashier',pin='2222'),Staff(name='Waiter 1',role='waiter',pin='3333'),Staff(name='Kitchen',role='kitchen',pin='4444')])
    if db.query(InventoryItem).count()==0: db.add_all([InventoryItem(name='Flour',unit='kg',qty=20,min_qty=5,cost=3),InventoryItem(name='Cheese',unit='kg',qty=10,min_qty=3,cost=25),InventoryItem(name='Cola Can',unit='pcs',qty=48,min_qty=12,cost=1.5)])
    defaults={'shop_name':'My Restaurant','shop_phone':'0500000000','shop_address':'Fujairah, UAE','vat_percent':'5','receipt_footer':'Thank you!','printer_ip':'','printer_port':'9100','auto_print':'false'}
    for k,v in defaults.items():
        if not db.query(Setting).filter(Setting.key==k).first(): db.add(Setting(key=k,value=v))
    db.commit(); db.close()
seed()

class MenuItemIn(BaseModel): name:str; category:str='General'; price:float; active:bool=True
class TableIn(BaseModel): name:str; seats:int=4
class StaffIn(BaseModel): name:str; role:str; pin:str; active:bool=True
class InventoryIn(BaseModel): name:str; unit:str='pcs'; qty:float=0; min_qty:float=0; cost:float=0
class ExpenseIn(BaseModel): title:str; amount:float
class CartItem(BaseModel): menu_item_id:int; qty:int=1; notes:str=''
class OrderIn(BaseModel): items:List[CartItem]; order_type:str='takeaway'; payment_method:str='cash'; table_id:Optional[int]=None; waiter_id:Optional[int]=None; discount:float=0; notes:str=''
class SettingsIn(BaseModel): shop_name:str; shop_phone:str; shop_address:str; vat_percent:float=5; receipt_footer:str='Thank you!'; printer_ip:str=''; printer_port:int=9100; auto_print:bool=False

app=FastAPI(title='Restaurant POS Full Starter')
app.add_middleware(CORSMiddleware,allow_origins=['*'],allow_credentials=True,allow_methods=['*'],allow_headers=['*'])

@app.get('/health')
def health(): return {'ok':True}
@app.get('/menu')
def menu():
    db=SessionLocal(); rows=db.query(MenuItem).filter(MenuItem.active==True).all(); out=[{'id':x.id,'name':x.name,'category':x.category,'price':x.price,'active':x.active} for x in rows]; db.close(); return out
@app.get('/admin/menu')
def admin_menu():
    db=SessionLocal(); rows=db.query(MenuItem).all(); out=[{'id':x.id,'name':x.name,'category':x.category,'price':x.price,'active':x.active} for x in rows]; db.close(); return out
@app.post('/admin/menu')
def add_menu(x:MenuItemIn):
    db=SessionLocal(); r=MenuItem(**x.model_dump()); db.add(r); db.commit(); db.refresh(r); i=r.id; db.close(); return {'id':i}
@app.delete('/admin/menu/{item_id}')
def del_menu(item_id:int):
    db=SessionLocal(); r=db.query(MenuItem).filter(MenuItem.id==item_id).first();
    if not r: db.close(); raise HTTPException(404,'Item not found')
    db.delete(r); db.commit(); db.close(); return {'ok':True}
@app.get('/tables')
def tables():
    db=SessionLocal(); rows=db.query(Table).all(); out=[{'id':x.id,'name':x.name,'seats':x.seats,'status':x.status} for x in rows]; db.close(); return out
@app.post('/tables')
def add_table(x:TableIn):
    db=SessionLocal(); r=Table(**x.model_dump()); db.add(r); db.commit(); db.refresh(r); i=r.id; db.close(); return {'id':i}
@app.get('/staff')
def staff():
    db=SessionLocal(); rows=db.query(Staff).all(); out=[{'id':x.id,'name':x.name,'role':x.role,'pin':x.pin,'active':x.active} for x in rows]; db.close(); return out
@app.post('/staff')
def add_staff(x:StaffIn):
    db=SessionLocal();
    if db.query(Staff).filter(Staff.pin==x.pin).first(): db.close(); raise HTTPException(400,'PIN already used')
    r=Staff(**x.model_dump()); db.add(r); db.commit(); db.refresh(r); i=r.id; db.close(); return {'id':i}
@app.get('/inventory')
def inventory():
    db=SessionLocal(); rows=db.query(InventoryItem).all(); out=[{'id':x.id,'name':x.name,'unit':x.unit,'qty':x.qty,'min_qty':x.min_qty,'cost':x.cost,'low':x.qty<=x.min_qty} for x in rows]; db.close(); return out
@app.post('/inventory')
def add_inventory(x:InventoryIn):
    db=SessionLocal(); r=InventoryItem(**x.model_dump()); db.add(r); db.commit(); db.refresh(r); i=r.id; db.close(); return {'id':i}
@app.post('/expenses')
def add_expense(x:ExpenseIn):
    db=SessionLocal(); db.add(Expense(**x.model_dump())); db.commit(); db.close(); return {'ok':True}
@app.get('/settings')
def settings():
    db=SessionLocal(); ks=['shop_name','shop_phone','shop_address','vat_percent','receipt_footer','printer_ip','printer_port','auto_print']; d={k:get_setting(db,k,'') for k in ks}; d['vat_percent']=float(d['vat_percent'] or 5); d['printer_port']=int(d['printer_port'] or 9100); d['auto_print']=str(d['auto_print']).lower()=='true'; db.close(); return d
@app.put('/settings')
def save_settings(x:SettingsIn):
    db=SessionLocal();
    for k,v in x.model_dump().items(): put_setting(db,k,str(v).lower() if isinstance(v,bool) else v)
    db.commit(); db.close(); return {'ok':True}
@app.post('/orders')
def add_order(x:OrderIn):
    db=SessionLocal(); subtotal=0; selected=[]
    for ci in x.items:
        m=db.query(MenuItem).filter(MenuItem.id==ci.menu_item_id,MenuItem.active==True).first()
        if not m: db.close(); raise HTTPException(400,'Invalid menu item')
        q=max(1,ci.qty); subtotal+=m.price*q; selected.append((m,q,ci.notes))
    discount=max(0,min(x.discount,subtotal)); taxable=subtotal-discount; vp=float(get_setting(db,'vat_percent','5')); vat=round(taxable*vp/100,2); total=round(taxable+vat,2)
    o=Order(order_type=x.order_type,table_id=x.table_id,waiter_id=x.waiter_id,payment_method=x.payment_method,subtotal=round(subtotal,2),discount=round(discount,2),vat=vat,total=total,status='new',notes=x.notes)
    for m,q,n in selected: o.items.append(OrderItem(menu_item_id=m.id,name=m.name,qty=q,unit_price=m.price,notes=n))
    db.add(o)
    if x.table_id:
        t=db.query(Table).filter(Table.id==x.table_id).first();
        if t: t.status='occupied'
    db.commit(); db.refresh(o); oid=o.id; db.close(); return {'id':oid,'subtotal':round(subtotal,2),'discount':round(discount,2),'vat':vat,'total':total}
@app.get('/orders')
def orders(status:Optional[str]=None):
    db=SessionLocal(); q=db.query(Order); q=q.filter(Order.status==status) if status else q; rows=q.order_by(Order.id.desc()).all(); out=[]
    for o in rows: out.append({'id':o.id,'status':o.status,'order_type':o.order_type,'table_id':o.table_id,'waiter_id':o.waiter_id,'payment_method':o.payment_method,'subtotal':o.subtotal,'discount':o.discount,'vat':o.vat,'total':o.total,'notes':o.notes,'created_at':o.created_at.isoformat(),'items':[{'name':i.name,'qty':i.qty,'unit_price':i.unit_price,'notes':i.notes} for i in o.items]})
    db.close(); return out
@app.get('/orders/{order_id}')
def order_detail(order_id:int):
    db=SessionLocal(); o=db.query(Order).filter(Order.id==order_id).first()
    if not o: db.close(); raise HTTPException(404,'Order not found')
    t=db.query(Table).filter(Table.id==o.table_id).first() if o.table_id else None; w=db.query(Staff).filter(Staff.id==o.waiter_id).first() if o.waiter_id else None
    s={k:get_setting(db,k,'') for k in ['shop_name','shop_phone','shop_address','vat_percent','receipt_footer']}
    out={'id':o.id,'status':o.status,'order_type':o.order_type,'table':t.name if t else None,'waiter':w.name if w else None,'payment_method':o.payment_method,'subtotal':o.subtotal,'discount':o.discount,'vat':o.vat,'total':o.total,'notes':o.notes,'created_at':o.created_at.isoformat(),'items':[{'name':i.name,'qty':i.qty,'unit_price':i.unit_price,'notes':i.notes} for i in o.items],'settings':s}; db.close(); return out
@app.patch('/orders/{order_id}/status/{status}')
def set_status(order_id:int,status:str):
    if status not in {'new','preparing','ready','completed','cancelled'}: raise HTTPException(400,'Invalid status')
    db=SessionLocal(); o=db.query(Order).filter(Order.id==order_id).first()
    if not o: db.close(); raise HTTPException(404,'Order not found')
    o.status=status
    if status in {'completed','cancelled'} and o.table_id:
        t=db.query(Table).filter(Table.id==o.table_id).first();
        if t: t.status='available'
    db.commit(); db.close(); return {'ok':True}
@app.get('/reports/today')
def reports_today():
    db=SessionLocal(); today=datetime.utcnow().date(); os=[o for o in db.query(Order).filter(Order.status!='cancelled').all() if o.created_at.date()==today]; es=[e for e in db.query(Expense).all() if e.created_at.date()==today]; sales=round(sum(o.total for o in os),2); cash=round(sum(o.total for o in os if o.payment_method=='cash'),2); card=round(sum(o.total for o in os if o.payment_method=='card'),2); vat=round(sum(o.vat for o in os),2); disc=round(sum(o.discount for o in os),2); exp=round(sum(e.amount for e in es),2); db.close(); return {'orders':len(os),'sales':sales,'cash':cash,'card':card,'vat':vat,'discounts':disc,'expenses':exp,'net_after_expenses':round(sales-exp,2)}

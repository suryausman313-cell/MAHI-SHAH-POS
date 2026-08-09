import React, {useEffect, useMemo, useState} from 'react'
import {api, money, sendToIpPrinter} from '../api'
import type {MenuItem, PosTable, Staff, Settings} from '../types'

type Customer={id:number;name:string;phone:string;address:string;points:number}
type Shift={id:number;opening_cash:number;expected_cash:number;cash_sales:number;card_sales:number}

export default function OrderBuilder({waiterMode=false}:{waiterMode?:boolean}){
  const loggedUser=(()=>{try{return JSON.parse(localStorage.getItem('mahi_user')||'null')}catch{return null}})()
  const isCashier=loggedUser?.role==='cashier'||loggedUser?.role==='admin'||loggedUser?.role==='manager'
  const isWaiter=loggedUser?.role==='waiter'||waiterMode
  const [menu,setMenu]=useState<MenuItem[]>([])
  const [tables,setTables]=useState<PosTable[]>([])
  const [staff,setStaff]=useState<Staff[]>([])
  const [customers,setCustomers]=useState<Customer[]>([])
  const [settings,setSettings]=useState<Settings|null>(null)
  const [shift,setShift]=useState<Shift|null>(null)
  const [held,setHeld]=useState<any[]>([])
  const [cart,setCart]=useState<Record<number,number>>({})
  const [mods,setMods]=useState<Record<number,number[]>>({})
  const [category,setCategory]=useState('All')
  const [search,setSearch]=useState('')
  const [barcode,setBarcode]=useState('')
  const [type,setType]=useState(waiterMode?'dinein':'takeaway')
  const [pay,setPay]=useState('cash')
  const [discount,setDiscount]=useState(0)
  const [cashPaid,setCashPaid]=useState(0)
  const [cardPaid,setCardPaid]=useState(0)
  const [tableId,setTableId]=useState<number|undefined>()
  const [waiterId,setWaiterId]=useState<number|undefined>()
  const [customerId,setCustomerId]=useState<number|undefined>()
  const [deliveryAddress,setDeliveryAddress]=useState('')
  const [coupon,setCoupon]=useState('')
  const [saving,setSaving]=useState(false)
  const [lastOrderId,setLastOrderId]=useState<number|null>(null)

  const load=async()=>{
    const [m,t,s,c,st,sh,h]=await Promise.all([
      api<MenuItem[]>('/menu'),api<PosTable[]>('/tables'),api<Staff[]>('/staff'),
      api<Customer[]>('/customers'),api<Settings>('/settings'),api<Shift|null>('/shifts/current'),
      api<any[]>('/orders/held/list')
    ])
    setMenu(m);setTables(t);setStaff(s);setCustomers(c);setSettings(st);setShift(sh);setHeld(h)
    if(isWaiter&&loggedUser?.id)setWaiterId(loggedUser.id)
  }
  useEffect(()=>{load().catch(console.error)},[])

  const categories=useMemo(()=>['All',...Array.from(new Set(menu.map(x=>x.category)))],[menu])
  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim()
    return menu.filter(i=>(category==='All'||i.category===category)&&(!q||i.name.toLowerCase().includes(q)||i.barcode===q))
  },[menu,category,search])
  const cartLines=useMemo(()=>menu.filter(i=>(cart[i.id]||0)>0),[menu,cart])
  const subtotal=useMemo(()=>cartLines.reduce((sum,i)=>{
    const modTotal=(mods[i.id]||[]).map(id=>i.modifiers?.find(m=>m.id===id)?.price||0).reduce((a,b)=>a+b,0)
    return sum+(cart[i.id]||0)*(i.price+modTotal)
  },0),[cartLines,cart,mods])
  const taxable=Math.max(0,subtotal-discount)
  const vatRate=Number(settings?.vat_percent??5)
  const vat=taxable*(vatRate/100)
  const total=taxable+vat

  const qty=(id:number,d:number)=>setCart(c=>({...c,[id]:Math.max(0,(c[id]||0)+d)}))
  const toggleMod=(itemId:number,modId:number)=>setMods(m=>{
    const a=m[itemId]||[]
    return {...m,[itemId]:a.includes(modId)?a.filter(x=>x!==modId):[...a,modId]}
  })

  const scan=async()=>{
    if(!barcode.trim())return
    try{
      const item:any=await api('/menu/barcode/'+encodeURIComponent(barcode.trim()))
      qty(item.id,1);setBarcode('')
    }catch(e:any){alert(e.message)}
  }

  const openShift=async()=>{
    const opening=prompt('Opening cash AED','0')
    if(opening===null)return
    const s:any=await api('/shifts/open',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({opening_cash:+opening||0})})
    await load();alert('Shift opened #'+s.id)
  }

  const closeShift=async()=>{
    if(!shift)return
    const actual=prompt(`Expected cash AED ${shift.expected_cash}\nEnter actual cash:`)
    if(actual===null)return
    const pin=prompt('Manager/Admin PIN')
    if(!pin)return
    try{
      const r:any=await api(`/shifts/${shift.id}/close`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actual_cash:+actual||0,staff_pin:pin})})
      alert(`Shift closed. Difference AED ${r.difference}`);await load()
    }catch(e:any){alert(e.message)}
  }

  const addCustomer=async()=>{
    const name=prompt('Customer name'); if(!name)return
    const phone=prompt('Phone')||''
    const address=prompt('Address')||''
    const r:any=await api('/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,address})})
    await load();setCustomerId(r.id)
  }

  const submit=async(hold=false)=>{
    const items=Object.entries(cart).filter(([,q])=>q>0).map(([id,q])=>({
      menu_item_id:+id,qty:q,modifier_ids:mods[+id]||[]
    }))
    if(!items.length){alert('Add items first');return}
    if(type==='dinein'&&!tableId){alert('Select table');return}
    if(isCashier&&settings?.require_shift&&!shift){alert('Open shift first');return}
    if(pay==='split'&&Math.abs((cashPaid+cardPaid)-total)>.01){alert('Cash + Card must equal total');return}
    setSaving(true)
    try{
      const created:any=await api('/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        items,order_type:type,payment_method:pay,cash_paid:pay==='split'?cashPaid:null,
        card_paid:pay==='split'?cardPaid:null,table_id:tableId||null,waiter_id:waiterId||null,
        customer_id:customerId||null,shift_id:shift?.id||null,discount,coupon_code:coupon,
        delivery_address:deliveryAddress,hold
      })})
      setLastOrderId(created.id);setCart({});setMods({});setDiscount(0);setCoupon('');setCashPaid(0);setCardPaid(0)
      if(!hold&&settings?.auto_print&&settings?.printer_ip){
        try{const full:any=await api('/orders/'+created.id);await sendToIpPrinter(full,settings)}
        catch(e:any){alert(`Order saved but print failed: ${e.message}`)}
      }
      alert(hold?`Order #${created.id} held`:`Order #${created.id} saved`)
      await load()
    }catch(e:any){alert(e.message)}finally{setSaving(false)}
  }

  const recall=async(id:number)=>{
    await api(`/orders/${id}/recall`,{method:'POST'});await load();alert(`Order #${id} recalled to kitchen`)
  }

  if(settings?.app_enabled===false){
    return <div className="closed-screen"><div><b>POS Disabled</b><span>Admin has disabled the application.</span></div></div>
  }
  if(settings?.shop_open===false){
    return <div className="closed-screen"><div><b>Shop Closed</b><span>Admin has closed ordering. Admin can reopen it from Control Center.</span></div></div>
  }

  return <div className="pos-workspace">
    <div className="product-area">
      {isCashier&&<div className="shift-strip"><div>{shift?<><b>Shift #{shift.id} OPEN</b><span>Expected cash {money(shift.expected_cash)}</span></>:<><b>No open shift</b><span>Open shift before sales</span></>}</div>{shift?<button onClick={closeShift}>Close Shift</button>:<button onClick={openShift}>Open Shift</button>}</div>}
      <div className="pos-toolbar">
        <div className="segment">
          {settings?.allow_takeaway!==false&&<button disabled={waiterMode} className={type==='takeaway'?'selected':''} onClick={()=>setType('takeaway')}>Takeaway</button>}
          {settings?.allow_dinein!==false&&<button className={type==='dinein'?'selected':''} onClick={()=>setType('dinein')}>Dine In</button>}
          {settings?.allow_delivery!==false&&<button disabled={waiterMode} className={type==='delivery'?'selected':''} onClick={()=>setType('delivery')}>Delivery</button>}
        </div>
        <input className="search-box" placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="barcode-box"><input placeholder="Barcode" value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&scan()}/><button onClick={scan}>Scan</button></div>
        {type==='dinein'&&<select value={tableId||''} onChange={e=>setTableId(+e.target.value||undefined)}><option value="">Select table</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select>}
        {isWaiter?<div className="staff-fixed-pill">Waiter: {loggedUser?.name||'Current staff'}</div>:<select value={waiterId||''} onChange={e=>setWaiterId(+e.target.value||undefined)}><option value="">No waiter</option>{staff.filter(s=>s.role==='waiter').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      </div>
      <div className="category-tabs">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      <div className="product-grid">{filtered.map(item=><div className="product-card-wrap" key={item.id}><button className="product-card" onClick={()=>qty(item.id,1)}><div className="product-photo">{item.image?<img src={item.image} alt={item.name}/>:<span>{item.name[0]}</span>}</div><div className="product-info"><small>{item.category}</small><strong>{item.name}</strong><b>{money(item.price)}</b></div>{(cart[item.id]||0)>0&&<em>{cart[item.id]}</em>}</button>{(cart[item.id]||0)>0&&item.modifiers?.length?<div className="modifier-mini">{item.modifiers.map(m=><label key={m.id}><input type="checkbox" checked={(mods[item.id]||[]).includes(m.id)} onChange={()=>toggleMod(item.id,m.id)}/>{m.name} +{m.price}</label>)}</div>:null}</div>)}</div>
    </div>
    <aside className="order-panel">
      <div className="order-panel-head"><div><span>Current order</span><strong>{type}</strong></div><button className="ghost-danger" onClick={()=>{setCart({});setMods({})}}>Clear</button></div>
      <div className="cart-lines">{!cartLines.length&&<div className="empty-cart"><div>🧾</div><strong>No items yet</strong><span>Tap a product to add it</span></div>}{cartLines.map(i=><div className="cart-line" key={i.id}><div className="cart-main"><strong>{i.name}</strong><small>{money(i.price)} each</small></div><div className="qty-stepper"><button onClick={()=>qty(i.id,-1)}>−</button><b>{cart[i.id]}</b><button onClick={()=>qty(i.id,1)}>+</button></div><strong>{money((cart[i.id]||0)*i.price)}</strong></div>)}</div>
      <div className="order-summary">
        <div className="customer-line"><select value={customerId||''} onChange={e=>setCustomerId(+e.target.value||undefined)}><option value="">No customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select><button onClick={addCustomer}>+</button></div>
        {type==='delivery'&&<input className="plain-input" placeholder="Delivery address" value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)}/>}
        {settings?.allow_coupons!==false&&<input className="plain-input" placeholder="Coupon code" value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}/>}
        {settings?.allow_discounts!==false&&<label><span>Discount</span><div className="money-input"><span>AED</span><input type="number" value={discount} onChange={e=>setDiscount(+e.target.value||0)}/></div></label>}
        <div className="summary-row"><span>Subtotal</span><b>{money(subtotal)}</b></div>{settings?.vat_enabled!==false&&<div className="summary-row"><span>VAT {vatRate}%</span><b>{money(vat)}</b></div>}<div className="summary-row total"><span>Total</span><b>{money(total)}</b></div>
        {isCashier&&<><div className="payment-switch">{['cash','card',...(settings?.allow_split_payment===false?[]:['split'])].map(x=><button key={x} className={pay===x?'active':''} onClick={()=>setPay(x)}>{x}</button>)}</div>{pay==='split'&&<div className="split-pay"><input type="number" placeholder="Cash" value={cashPaid||''} onChange={e=>setCashPaid(+e.target.value||0)}/><input type="number" placeholder="Card" value={cardPaid||''} onChange={e=>setCardPaid(+e.target.value||0)}/></div>}<button className="pay-button" onClick={()=>submit(false)} disabled={saving}>{saving?'Saving...':`SAVE ORDER · ${money(total)}`}</button>{settings?.allow_hold_orders!==false&&<button className="secondary-button" onClick={()=>submit(true)}>HOLD ORDER</button>}</>}{isWaiter&&<><button className="pay-button waiter-send" onClick={()=>submit(false)} disabled={saving}>{saving?'Sending...':'SEND ORDER TO KITCHEN'}</button>{settings?.allow_hold_orders!==false&&<button className="secondary-button" onClick={()=>submit(true)}>HOLD ORDER</button>}</>}
        {held.length>0&&<div className="held-box"><b>Held orders</b>{held.slice(0,5).map(h=><button key={h.id} onClick={()=>recall(h.id)}>Recall #{h.id} · {money(h.total)}</button>)}</div>}
      </div>
    </aside>
  </div>
}

import React, {useEffect, useMemo, useState} from 'react'
import {api, money, sendToIpPrinter} from '../api'
import type {MenuItem, PosTable, Staff, Settings} from '../types'

export default function OrderBuilder({waiterMode=false}:{waiterMode?:boolean}){
  const [menu,setMenu] = useState<MenuItem[]>([])
  const [tables,setTables] = useState<PosTable[]>([])
  const [staff,setStaff] = useState<Staff[]>([])
  const [settings,setSettings] = useState<Settings|null>(null)
  const [cart,setCart] = useState<Record<number,number>>({})
  const [category,setCategory] = useState('All')
  const [search,setSearch] = useState('')
  const [type,setType] = useState(waiterMode ? 'dinein' : 'takeaway')
  const [pay,setPay] = useState('cash')
  const [discount,setDiscount] = useState(0)
  const [tableId,setTableId] = useState<number|undefined>()
  const [waiterId,setWaiterId] = useState<number|undefined>()
  const [saving,setSaving] = useState(false)
  const [lastOrderId,setLastOrderId] = useState<number|null>(null)

  const load = async()=>{
    const [m,t,s,st] = await Promise.all([
      api<MenuItem[]>('/menu'),
      api<PosTable[]>('/tables'),
      api<Staff[]>('/staff'),
      api<Settings>('/settings'),
    ])
    setMenu(m); setTables(t); setStaff(s); setSettings(st)
  }

  useEffect(()=>{ load().catch(e=>console.error(e)) },[])

  const categories = useMemo(
    ()=>['All',...Array.from(new Set(menu.map(x=>x.category)))],
    [menu]
  )

  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase()
    return menu.filter(item=>{
      const byCategory = category==='All' || item.category===category
      const bySearch = !q || item.name.toLowerCase().includes(q)
      return byCategory && bySearch
    })
  },[menu,category,search])

  const cartLines = useMemo(
    ()=>menu.filter(x=>(cart[x.id]||0)>0),
    [menu,cart]
  )

  const subtotal = useMemo(
    ()=>cartLines.reduce((sum,item)=>sum+(cart[item.id]||0)*item.price,0),
    [cartLines,cart]
  )

  const taxable = Math.max(0, subtotal-discount)
  const vatRate = Number(settings?.vat_percent ?? 5)
  const vat = taxable * (vatRate/100)
  const total = taxable + vat

  const changeQty = (id:number, delta:number)=>{
    setCart(c=>({...c,[id]:Math.max(0,(c[id]||0)+delta)}))
  }

  const clearCart = ()=>{
    setCart({})
    setDiscount(0)
    setLastOrderId(null)
  }

  const printBrowser = async(id:number)=>{
    const order:any = await api('/orders/'+id)
    const w = window.open('','receipt','width=420,height=720')
    if(!w) return
    const rows = order.items.map((i:any)=>(
      `<tr><td>${i.qty} × ${i.name}</td><td style="text-align:right">${(i.qty*i.unit_price).toFixed(2)}</td></tr>`
    )).join('')
    w.document.write(`
      <html><head><title>Receipt #${order.id}</title>
      <style>
      body{font-family:monospace;width:76mm;margin:0 auto;padding:4mm;font-size:12px}
      h2,p{margin:4px 0;text-align:center}table{width:100%;border-collapse:collapse}
      td{padding:4px 0;border-bottom:1px dashed #aaa}.tot{font-weight:bold;font-size:15px}
      @media print{button{display:none}}
      </style></head><body>
      <h2>${order.settings.shop_name}</h2>
      <p>${order.settings.shop_address}</p><p>${order.settings.shop_phone}</p>
      <hr/><p>Order #${order.id} • ${String(order.order_type).toUpperCase()}</p>
      ${order.table?`<p>${order.table}</p>`:''}
      ${order.waiter?`<p>Waiter: ${order.waiter}</p>`:''}
      <table>${rows}</table>
      <table>
      <tr><td>Subtotal</td><td style="text-align:right">${order.subtotal.toFixed(2)}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">${order.discount.toFixed(2)}</td></tr>
      <tr><td>VAT</td><td style="text-align:right">${order.vat.toFixed(2)}</td></tr>
      <tr class="tot"><td>TOTAL AED</td><td style="text-align:right">${order.total.toFixed(2)}</td></tr>
      </table>
      <p>Payment: ${String(order.payment_method).toUpperCase()}</p>
      <p>${order.settings.receipt_footer}</p>
      <button onclick="window.print()">PRINT</button>
      </body></html>`)
    w.document.close()
  }

  const submit = async()=>{
    const items = Object.entries(cart)
      .filter(([,qty])=>qty>0)
      .map(([id,qty])=>({menu_item_id:+id,qty}))

    if(!items.length){ alert('Add items first'); return }
    if(type==='dinein' && !tableId){ alert('Select a table'); return }

    setSaving(true)
    try{
      const created:any = await api('/orders',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          items,
          order_type:type,
          payment_method:pay,
          table_id:tableId || null,
          waiter_id:waiterId || null,
          discount
        })
      })

      setLastOrderId(created.id)
      setCart({})
      setDiscount(0)

      if(settings?.auto_print && settings?.printer_ip){
        try{
          const fullOrder:any = await api('/orders/'+created.id)
          await sendToIpPrinter(fullOrder,settings)
          alert(`Order #${created.id} saved & printed`)
        }catch(e:any){
          alert(`Order #${created.id} saved, but printer did not print.\n${e.message}\nStart the MAHI POS Printer Bridge on cashier PC.`)
        }
      }else{
        alert(`Order #${created.id} saved`)
      }
    }catch(e:any){
      alert(e.message)
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="pos-workspace">
      <div className="product-area">
        <div className="pos-toolbar">
          <div className="segment">
            {['takeaway','dinein','delivery'].map(v=>(
              <button
                key={v}
                disabled={waiterMode && v!=='dinein'}
                className={type===v?'selected':''}
                onClick={()=>setType(v)}
              >
                {v==='takeaway'?'Takeaway':v==='dinein'?'Dine In':'Delivery'}
              </button>
            ))}
          </div>

          <input
            className="search-box"
            placeholder="Search products..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />

          {type==='dinein' && (
            <select value={tableId||''} onChange={e=>setTableId(+e.target.value||undefined)}>
              <option value="">Select table</option>
              {tables.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}
            </select>
          )}

          <select value={waiterId||''} onChange={e=>setWaiterId(+e.target.value||undefined)}>
            <option value="">No waiter</option>
            {staff.filter(s=>s.role==='waiter').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="category-tabs">
          {categories.map(c=>(
            <button
              key={c}
              className={category===c?'active':''}
              onClick={()=>setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="product-grid">
          {filtered.map(item=>(
            <button
              className="product-card"
              key={item.id}
              onClick={()=>changeQty(item.id,1)}
            >
              <div className="product-photo">
                <span>{item.name.slice(0,1).toUpperCase()}</span>
              </div>
              <div className="product-info">
                <small>{item.category}</small>
                <strong>{item.name}</strong>
                <b>{money(item.price)}</b>
              </div>
              {(cart[item.id]||0)>0 && <em>{cart[item.id]}</em>}
            </button>
          ))}
        </div>
      </div>

      <aside className="order-panel">
        <div className="order-panel-head">
          <div>
            <span>Current order</span>
            <strong>{type==='dinein' ? 'Dine In' : type==='delivery' ? 'Delivery' : 'Takeaway'}</strong>
          </div>
          <button className="ghost-danger" onClick={clearCart}>Clear</button>
        </div>

        <div className="cart-lines">
          {!cartLines.length && (
            <div className="empty-cart">
              <div>🧾</div>
              <strong>No items yet</strong>
              <span>Tap a product to add it</span>
            </div>
          )}

          {cartLines.map(item=>(
            <div className="cart-line" key={item.id}>
              <div className="cart-main">
                <strong>{item.name}</strong>
                <small>{money(item.price)} each</small>
              </div>
              <div className="qty-stepper">
                <button onClick={()=>changeQty(item.id,-1)}>−</button>
                <b>{cart[item.id]}</b>
                <button onClick={()=>changeQty(item.id,1)}>+</button>
              </div>
              <strong>{money((cart[item.id]||0)*item.price)}</strong>
            </div>
          ))}
        </div>

        <div className="order-summary">
          <label>
            <span>Discount</span>
            <div className="money-input">
              <span>AED</span>
              <input type="number" value={discount} onChange={e=>setDiscount(+e.target.value||0)}/>
            </div>
          </label>

          <div className="summary-row"><span>Subtotal</span><b>{money(subtotal)}</b></div>
          <div className="summary-row"><span>VAT {vatRate}%</span><b>{money(vat)}</b></div>
          <div className="summary-row total"><span>Total</span><b>{money(total)}</b></div>

          <div className="payment-switch">
            <button className={pay==='cash'?'active':''} onClick={()=>setPay('cash')}>Cash</button>
            <button className={pay==='card'?'active':''} onClick={()=>setPay('card')}>Card</button>
          </div>

          <button className="pay-button" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : `SAVE ORDER · ${money(total)}`}
          </button>

          {lastOrderId && (
            <button className="secondary-button" onClick={()=>printBrowser(lastOrderId)}>
              Print receipt #{lastOrderId}
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}

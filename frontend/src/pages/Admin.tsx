import React, {useEffect, useMemo, useState} from 'react'
import Shell from '../components/Shell'
import StatCard from '../components/StatCard'
import {api, money, orderTime, PRINT_BRIDGE, sendToIpPrinter} from '../api'
import type {InventoryItem, MenuItem, Order, Settings, Staff} from '../types'

type Tab = 'dashboard'|'orders'|'menu'|'inventory'|'staff'|'reports'|'printer'

const tabs:{key:Tab;icon:string;label:string}[] = [
  {key:'dashboard',icon:'◫',label:'Dashboard'},
  {key:'orders',icon:'▤',label:'Orders'},
  {key:'menu',icon:'☷',label:'Menu'},
  {key:'inventory',icon:'▥',label:'Inventory'},
  {key:'staff',icon:'♙',label:'Staff'},
  {key:'reports',icon:'↗',label:'Reports'},
  {key:'printer',icon:'▣',label:'Printer'},
]

export default function Admin(){
  const [tab,setTab] = useState<Tab>('dashboard')
  const [report,setReport] = useState<any>({})
  const [menu,setMenu] = useState<MenuItem[]>([])
  const [orders,setOrders] = useState<Order[]>([])
  const [inventory,setInventory] = useState<InventoryItem[]>([])
  const [staff,setStaff] = useState<Staff[]>([])
  const [settings,setSettings] = useState<Settings>({
    shop_name:'',shop_phone:'',shop_address:'',vat_percent:5,
    receipt_footer:'Thank you!',printer_ip:'',printer_port:9100,auto_print:false
  })

  const [menuForm,setMenuForm] = useState({name:'',category:'General',price:''})
  const [invForm,setInvForm] = useState({name:'',unit:'pcs',qty:''})
  const [staffForm,setStaffForm] = useState({name:'',role:'cashier',pin:''})

  const load = async()=>{
    const [r,m,o,i,s,st] = await Promise.all([
      api('/reports/today'),
      api<MenuItem[]>('/admin/menu'),
      api<Order[]>('/orders'),
      api<InventoryItem[]>('/inventory'),
      api<Staff[]>('/staff'),
      api<Settings>('/settings')
    ])
    setReport(r);setMenu(m);setOrders(o);setInventory(i);setStaff(s);setSettings(st)
  }

  useEffect(()=>{load().catch(e=>alert(e.message))},[])

  const categoryCount = useMemo(()=>new Set(menu.map(x=>x.category)).size,[menu])
  const avgOrder = report.orders ? Number(report.sales||0)/Number(report.orders) : 0

  const addMenu=async()=>{
    if(!menuForm.name || !menuForm.price) return
    await api('/admin/menu',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:menuForm.name,category:menuForm.category,price:+menuForm.price,active:true
      })
    })
    setMenuForm({name:'',category:'General',price:''}); await load()
  }

  const deleteMenu=async(id:number)=>{
    if(!confirm('Delete this menu item?')) return
    await api('/admin/menu/'+id,{method:'DELETE'}); await load()
  }

  const addInventory=async()=>{
    if(!invForm.name) return
    await api('/inventory',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:invForm.name,unit:invForm.unit,qty:+invForm.qty||0,min_qty:0,cost:0
      })
    })
    setInvForm({name:'',unit:'pcs',qty:''}); await load()
  }

  const updateStock=async(id:number,current:number)=>{
    const raw=prompt('New quantity',String(current))
    if(raw===null) return
    await api('/inventory/'+id,{
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({qty:+raw||0})
    })
    await load()
  }

  const addStaff=async()=>{
    if(!staffForm.name || !staffForm.pin) return
    await api('/staff',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...staffForm,active:true})
    })
    setStaffForm({name:'',role:'cashier',pin:''}); await load()
  }

  const saveSettings=async()=>{
    await api('/settings',{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(settings)
    })
    alert('Settings saved')
    await load()
  }

  const testPrinter=async()=>{
    try{
      const isAndroidNative = !!(window as any).AndroidPrinter
      if(!isAndroidNative){
        const health = await fetch(PRINT_BRIDGE+'/health')
        if(!health.ok) throw new Error('Printer bridge is not running')
      }
      const testOrder:any={
        id:'TEST',order_type:'test',payment_method:'cash',
        subtotal:0,discount:0,vat:0,total:0,
        items:[{qty:1,name:'MAHI POS TEST PRINT',unit_price:0}]
      }
      await sendToIpPrinter(testOrder,settings)
      alert('Test print sent successfully')
    }catch(e:any){
      const nativeMsg = (window as any).AndroidPrinter
        ? 'Check printer IP, port, Wi-Fi and printer power.'
        : 'Run print-bridge/start-printer-bridge.bat on the cashier PC.'
      alert('Printer test failed: '+e.message+'\n'+nativeMsg)
    }
  }

  return (
    <Shell title="Admin Console" subtitle="Manage your restaurant from one place">
      <div className="admin-layout">
        <aside className="admin-nav">
          {tabs.map(t=>(
            <button key={t.key} className={tab===t.key?'active':''} onClick={()=>setTab(t.key)}>
              <i>{t.icon}</i><span>{t.label}</span>
            </button>
          ))}
        </aside>

        <section className="admin-content">
          {tab==='dashboard' && (
            <>
              <div className="admin-section-head">
                <div><h2>Today overview</h2><p>Live performance of this branch</p></div>
              </div>
              <div className="stat-grid">
                <StatCard label="Net sales" value={money(report.sales)} icon="↗"/>
                <StatCard label="Orders" value={report.orders||0} icon="▤"/>
                <StatCard label="Average order" value={money(avgOrder)} icon="◎"/>
                <StatCard label="VAT" value={money(report.vat)} icon="%"/>
                <StatCard label="Cash" value={money(report.cash)} icon="▣"/>
                <StatCard label="Card" value={money(report.card)} icon="▭"/>
                <StatCard label="Discounts" value={money(report.discounts)} icon="−"/>
                <StatCard label="Expenses" value={money(report.expenses)} icon="↓"/>
              </div>

              <div className="two-col">
                <div className="panel-card">
                  <div className="panel-title"><h3>Recent orders</h3><button onClick={()=>setTab('orders')}>View all</button></div>
                  <div className="admin-table">
                    <div className="tr th"><span>Order</span><span>Type</span><span>Payment</span><span>Total</span></div>
                    {orders.slice(0,6).map(o=>(
                      <div className="tr" key={o.id}>
                        <span><b>#{o.id}</b><small>{orderTime(o.created_at)}</small></span>
                        <span>{o.order_type}</span>
                        <span>{o.payment_method}</span>
                        <span><b>{money(o.total)}</b></span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel-card">
                  <div className="panel-title"><h3>Quick status</h3></div>
                  <div className="quick-status">
                    <div><span>Menu items</span><b>{menu.length}</b></div>
                    <div><span>Categories</span><b>{categoryCount}</b></div>
                    <div><span>Low stock</span><b>{inventory.filter(x=>x.low).length}</b></div>
                    <div><span>Staff</span><b>{staff.length}</b></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab==='orders' && (
            <>
              <div className="admin-section-head"><div><h2>Orders</h2><p>Order history and current status</p></div></div>
              <div className="panel-card">
                <div className="admin-table wide">
                  <div className="tr th"><span>#</span><span>Time</span><span>Type</span><span>Status</span><span>Payment</span><span>Total</span></div>
                  {orders.map(o=>(
                    <div className="tr" key={o.id}>
                      <span><b>#{o.id}</b></span>
                      <span>{orderTime(o.created_at)}</span>
                      <span>{o.order_type}</span>
                      <span><em className={`status-badge ${o.status}`}>{o.status}</em></span>
                      <span>{o.payment_method}</span>
                      <span><b>{money(o.total)}</b></span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab==='menu' && (
            <>
              <div className="admin-section-head"><div><h2>Menu</h2><p>Products, prices and categories</p></div></div>
              <div className="form-card">
                <input placeholder="Item name" value={menuForm.name} onChange={e=>setMenuForm({...menuForm,name:e.target.value})}/>
                <input placeholder="Category" value={menuForm.category} onChange={e=>setMenuForm({...menuForm,category:e.target.value})}/>
                <input type="number" placeholder="Price" value={menuForm.price} onChange={e=>setMenuForm({...menuForm,price:e.target.value})}/>
                <button className="primary-btn" onClick={addMenu}>Add item</button>
              </div>
              <div className="menu-admin-grid">
                {menu.map(i=>(
                  <article key={i.id}>
                    <div className="mini-product">{i.name.slice(0,1).toUpperCase()}</div>
                    <div><small>{i.category}</small><strong>{i.name}</strong><b>{money(i.price)}</b></div>
                    <button onClick={()=>deleteMenu(i.id)}>Delete</button>
                  </article>
                ))}
              </div>
            </>
          )}

          {tab==='inventory' && (
            <>
              <div className="admin-section-head"><div><h2>Inventory</h2><p>Stock levels and low-stock alerts</p></div></div>
              <div className="form-card">
                <input placeholder="Stock item" value={invForm.name} onChange={e=>setInvForm({...invForm,name:e.target.value})}/>
                <input placeholder="Unit" value={invForm.unit} onChange={e=>setInvForm({...invForm,unit:e.target.value})}/>
                <input type="number" placeholder="Quantity" value={invForm.qty} onChange={e=>setInvForm({...invForm,qty:e.target.value})}/>
                <button className="primary-btn" onClick={addInventory}>Add stock</button>
              </div>
              <div className="panel-card">
                <div className="admin-table">
                  <div className="tr th"><span>Item</span><span>On hand</span><span>Minimum</span><span>Status</span></div>
                  {inventory.map(i=>(
                    <div className="tr clickable" key={i.id} onClick={()=>updateStock(i.id,i.qty)}>
                      <span><b>{i.name}</b><small>{i.unit}</small></span>
                      <span>{i.qty} {i.unit}</span>
                      <span>{i.min_qty} {i.unit}</span>
                      <span>{i.low?<em className="status-badge cancelled">Low stock</em>:<em className="status-badge ready">Healthy</em>}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab==='staff' && (
            <>
              <div className="admin-section-head"><div><h2>Staff & PIN</h2><p>Cashier, waiter, kitchen and admin access</p></div></div>
              <div className="form-card">
                <input placeholder="Staff name" value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})}/>
                <select value={staffForm.role} onChange={e=>setStaffForm({...staffForm,role:e.target.value})}>
                  <option value="cashier">Cashier</option><option value="waiter">Waiter</option>
                  <option value="kitchen">Kitchen</option><option value="admin">Admin</option>
                </select>
                <input placeholder="PIN" value={staffForm.pin} onChange={e=>setStaffForm({...staffForm,pin:e.target.value})}/>
                <button className="primary-btn" onClick={addStaff}>Add staff</button>
              </div>
              <div className="staff-grid">
                {staff.map(s=>(
                  <article key={s.id}>
                    <div className="avatar">{s.name.slice(0,1).toUpperCase()}</div>
                    <strong>{s.name}</strong><span>{s.role}</span><small>PIN {s.pin}</small>
                  </article>
                ))}
              </div>
            </>
          )}

          {tab==='reports' && (
            <>
              <div className="admin-section-head"><div><h2>Reports</h2><p>Sales and payment summary</p></div></div>
              <div className="report-hero">
                <div><span>Today's sales</span><strong>{money(report.sales)}</strong><small>{report.orders||0} orders</small></div>
                <div className="payment-bars">
                  <label><span>Cash</span><b>{money(report.cash)}</b></label>
                  <div><i style={{width:`${report.sales?Math.min(100,(report.cash/report.sales)*100):0}%`}}></i></div>
                  <label><span>Card</span><b>{money(report.card)}</b></label>
                  <div><i style={{width:`${report.sales?Math.min(100,(report.card/report.sales)*100):0}%`}}></i></div>
                </div>
              </div>
              <div className="stat-grid">
                <StatCard label="Gross / Net sales" value={money(report.sales)} icon="↗"/>
                <StatCard label="VAT collected" value={money(report.vat)} icon="%"/>
                <StatCard label="Discounts" value={money(report.discounts)} icon="−"/>
                <StatCard label="After expenses" value={money(report.net_after_expenses)} icon="◎"/>
              </div>
            </>
          )}

          {tab==='printer' && (
            <>
              <div className="admin-section-head"><div><h2>Receipt printer</h2><p>LAN / Wi-Fi ESC/POS printer settings</p></div></div>
              <div className="settings-grid">
                <div className="settings-card">
                  <h3>Restaurant details</h3>
                  <label>Shop name<input value={settings.shop_name||''} onChange={e=>setSettings({...settings,shop_name:e.target.value})}/></label>
                  <label>Phone<input value={settings.shop_phone||''} onChange={e=>setSettings({...settings,shop_phone:e.target.value})}/></label>
                  <label>Address<input value={settings.shop_address||''} onChange={e=>setSettings({...settings,shop_address:e.target.value})}/></label>
                  <label>VAT %<input type="number" value={settings.vat_percent||5} onChange={e=>setSettings({...settings,vat_percent:+e.target.value})}/></label>
                  <label>Receipt footer<input value={settings.receipt_footer||''} onChange={e=>setSettings({...settings,receipt_footer:e.target.value})}/></label>
                </div>

                <div className="settings-card printer-card">
                  <div className="printer-illustration">▣</div>
                  <h3>Thermal printer</h3>
                  <label>Printer IP<input placeholder="192.168.1.50" value={settings.printer_ip||''} onChange={e=>setSettings({...settings,printer_ip:e.target.value})}/></label>
                  <label>Port<input type="number" value={settings.printer_port||9100} onChange={e=>setSettings({...settings,printer_port:+e.target.value})}/></label>
                  <label className="switch-line">
                    <span><b>Auto print</b><small>Print when order is saved</small></span>
                    <input type="checkbox" checked={!!settings.auto_print} onChange={e=>setSettings({...settings,auto_print:e.target.checked})}/>
                  </label>
                  <div className="button-row">
                    <button className="secondary-btn" onClick={testPrinter}>Test printer</button>
                    <button className="primary-btn" onClick={saveSettings}>Save settings</button>
                  </div>
                  <p className="helper">Android Cashier app: just enter printer IP + port, turn Auto Print ON, and keep the tablet/mobile and printer on the same Wi-Fi/LAN. Browser/Windows use still needs the optional print bridge.</p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Shell>
  )
}

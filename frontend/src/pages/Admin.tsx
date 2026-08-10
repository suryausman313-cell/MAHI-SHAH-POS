import React,{useEffect,useMemo,useState} from 'react'
import Shell from '../components/Shell'
import {api,money,orderTime,PRINT_BRIDGE,sendToIpPrinter} from '../api'
import type {InventoryItem,MenuItem,Order,Settings,Staff} from '../types'

type Tab='dashboard'|'control'|'orders'|'shifts'|'menu'|'inventory'|'customers'|'suppliers'|'expenses'|'staff'|'reports'|'coupons'|'audit'|'advanced'|'printer'

const tabs:{key:Tab;icon:string;label:string;group:string}[]=[
 {key:'dashboard',icon:'◫',label:'Dashboard',group:'MAIN'},
 {key:'control',icon:'⚙',label:'Control Center',group:'MAIN'},
 {key:'orders',icon:'▤',label:'Orders',group:'MAIN'},
 {key:'shifts',icon:'◷',label:'Shift & Closing',group:'MAIN'},
 {key:'menu',icon:'☷',label:'Menu',group:'MANAGE'},
 {key:'inventory',icon:'▥',label:'Inventory',group:'MANAGE'},
 {key:'customers',icon:'♙',label:'Customers',group:'MANAGE'},
 {key:'suppliers',icon:'▧',label:'Suppliers',group:'MANAGE'},
 {key:'expenses',icon:'↓',label:'Expenses',group:'MANAGE'},
 {key:'staff',icon:'♙',label:'Staff',group:'MANAGE'},
 {key:'reports',icon:'↗',label:'Reports',group:'INSIGHTS'},
 
 {key:'audit',icon:'≡',label:'Audit Log',group:'INSIGHTS'},
 {key:'advanced',icon:'⚒',label:'Advanced',group:'SYSTEM'},
 {key:'printer',icon:'▣',label:'Printer & Shop',group:'SYSTEM'},
]

const Stat=({label,value,sub,icon,tone='blue'}:{label:string,value:any,sub?:string,icon:string,tone?:string})=>(
 <div className={`pro-stat ${tone}`}>
   <div className="pro-stat-icon">{icon}</div>
   <div><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>
 </div>
)


function VatReportCard(){
 const[data,setData]=useState<any>(null)
 const[start,setStart]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`})
 const[end,setEnd]=useState(()=>new Date().toISOString().slice(0,10))
 const load=()=>api(`/reports/uae-vat?start=${start}&end=${end}`).then(setData).catch((e:any)=>alert(e.message))
 useEffect(()=>{load()},[])
 return <div className="pro-card uae-vat-card">
  <div className="pro-card-head"><div><h3>UAE VAT Return Summary</h3><p>Sales/output VAT summary for FTA filing support</p></div></div>
  <div className="vat-report-controls"><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/><button className="secondary-btn" onClick={load}>Refresh</button></div>
  {data&&<div className="vat-report-grid">
   <div><span>Sales incl. VAT</span><b>{money(data.standard_rated_sales_including_vat)}</b></div>
   <div><span>Sales excl. VAT</span><b>{money(data.standard_rated_sales_excluding_vat)}</b></div>
   <div><span>Output VAT</span><b>{money(data.output_vat_collected)}</b></div>
   <div><span>Refunds</span><b>{money(data.refunds)}</b></div>
   <div><span>Expenses</span><b>{money(data.expenses_total)}</b></div>
   <div><span>Input VAT</span><b>Enter from tax invoices</b></div>
  </div>}
  <p className="helper">This report prepares the sales/output side. Recoverable input VAT should come from valid supplier tax invoices, not from automatically assuming 5% of every expense.</p>
 </div>
}


function DayPartsSalesCard({settings,onSettingsChange,onSave}:{settings:any;onSettingsChange:(x:any)=>void;onSave:()=>void}){
 const[today,setToday]=useState(()=>new Date().toISOString().slice(0,10))
 const[data,setData]=useState<any>(null)
 const load=()=>api(`/reports/day-parts?business_date=${today}`).then(setData).catch((e:any)=>alert(e.message))
 useEffect(()=>{load()},[])
 const block=(x:any)=>x?<div className="daypart-box">
   <div className="daypart-title"><div><b>{x.label}</b><span>{x.start} – {x.end}</span></div><strong>{money(x.gross_sales)}</strong></div>
   <div className="daypart-stats"><span>Cash <b>{money(x.cash)}</b></span><span>Card <b>{money(x.card)}</b></span><span>Orders <b>{x.orders}</b></span></div>
 </div>:null
 return <div className="pro-card dayparts-card">
   <div className="pro-card-head"><div><h3>Morning / Evening Sales</h3><p>One shift stays open all day; these are time-based sales sections.</p></div></div>
   <div className="dayparts-settings">
     <label>Morning Name<input value={settings.morning_sales_label||'Morning'} onChange={e=>onSettingsChange({...settings,morning_sales_label:e.target.value})}/></label>
     <label>From<input type="time" value={settings.morning_sales_start||'08:00'} onChange={e=>onSettingsChange({...settings,morning_sales_start:e.target.value})}/></label>
     <label>To<input type="time" value={settings.morning_sales_end||'16:00'} onChange={e=>onSettingsChange({...settings,morning_sales_end:e.target.value})}/></label>
     <label>Evening Name<input value={settings.evening_sales_label||'Evening'} onChange={e=>onSettingsChange({...settings,evening_sales_label:e.target.value})}/></label>
     <label>From<input type="time" value={settings.evening_sales_start||'16:00'} onChange={e=>onSettingsChange({...settings,evening_sales_start:e.target.value})}/></label>
     <label>To<input type="time" value={settings.evening_sales_end||'01:00'} onChange={e=>onSettingsChange({...settings,evening_sales_end:e.target.value})}/></label>
     <button className="primary-btn" onClick={async()=>{await onSave();load()}}>Save Times</button>
   </div>
   <div className="dayparts-date"><input type="date" value={today} onChange={e=>setToday(e.target.value)}/><button className="secondary-btn" onClick={load}>Show Date</button></div>
   {data&&<div className="dayparts-grid">{block(data.morning)}{block(data.evening)}
     <div className="daypart-box full"><div className="daypart-title"><div><b>Full Day</b><span>Whole business date</span></div><strong>{money(data.full_day.gross_sales)}</strong></div>
     <div className="daypart-stats"><span>Cash <b>{money(data.full_day.cash)}</b></span><span>Card <b>{money(data.full_day.card)}</b></span><span>Orders <b>{data.full_day.orders}</b></span></div></div>
   </div>}
 </div>
}

export default function Admin(){
 const vatInside=(price:number)=>{
   if(settings?.vat_enabled===false||settings?.vat_inclusive===false)return 0
   const rate=Number(settings?.vat_percent||5)
   return price-(price/(1+rate/100))
 }
 const[tab,setTab]=useState<Tab>('dashboard')
 const[report,setReport]=useState<any>({})
 const[menu,setMenu]=useState<MenuItem[]>([])
 const[orders,setOrders]=useState<Order[]>([])
 const[inventory,setInventory]=useState<InventoryItem[]>([])
 const[staff,setStaff]=useState<Staff[]>([])
 const[customers,setCustomers]=useState<any[]>([])
 const[suppliers,setSuppliers]=useState<any[]>([])
 const[purchases,setPurchases]=useState<any[]>([])
 const[expenses,setExpenses]=useState<any[]>([])
 const[shifts,setShifts]=useState<any[]>([])
 const[currentShift,setCurrentShift]=useState<any>(null)
 const[coupons,setCoupons]=useState<any[]>([])
 const[audit,setAudit]=useState<any[]>([])
 const[foodCost,setFoodCost]=useState<any[]>([])
 const[stations,setStations]=useState<any[]>([])
 const[deals,setDeals]=useState<any[]>([])
 const[transfers,setTransfers]=useState<any[]>([])
 const[settings,setSettings]=useState<any>({
   shop_name:'',shop_phone:'',shop_address:'',trn:'',vat_percent:5,vat_inclusive:true,cashier_card_size:'auto',business_timezone_offset_minutes:240,
   morning_sales_label:'Morning',morning_sales_start:'08:00',morning_sales_end:'16:00',
   evening_sales_label:'Evening',evening_sales_start:'16:00',evening_sales_end:'01:00',
   receipt_footer:'Thank you!',printer_ip:'',printer_port:9100,auto_print:false,
   kitchen_sound:true,require_shift:true,currency:'AED',
   payment_terminal_provider:'',payment_terminal_enabled:false,auto_cash_drawer:true
 })
 const[menuForm,setMenuForm]=useState({name:'',category:'General',price:'',barcode:''})
 const[invForm,setInvForm]=useState({name:'',unit:'pcs',qty:''})
 const[staffForm,setStaffForm]=useState({name:'',role:'cashier',pin:''})
 const[custForm,setCustForm]=useState({name:'',phone:'',address:''})
 const[supForm,setSupForm]=useState({name:'',phone:'',email:''})
 const[expForm,setExpForm]=useState({title:'',amount:'',category:'General'})
 const[couponForm,setCouponForm]=useState({code:'',discount_type:'fixed',value:''})

 const load=async()=>{
  const[r,m,o,i,s,c,su,p,e,sh,cs,co,a,st,fc,ks,de,tr]=await Promise.all([
   api('/reports/today'),api<MenuItem[]>('/admin/menu'),api<Order[]>('/orders'),
   api<InventoryItem[]>('/inventory'),api<Staff[]>('/staff'),api<any[]>('/customers'),
   api<any[]>('/suppliers'),api<any[]>('/purchases'),api<any[]>('/expenses'),
   api<any[]>('/shifts'),api('/shifts/current'),api<any[]>('/coupons'),
   api<any[]>('/audit'),api<Settings>('/settings'),api<any[]>('/food-cost'),
   api<any[]>('/kitchen-stations'),api<any[]>('/deals'),api<any[]>('/stock-transfer')
  ])
  setReport(r);setMenu(m);setOrders(o);setInventory(i);setStaff(s);setCustomers(c)
  setSuppliers(su);setPurchases(p);setExpenses(e);setShifts(sh);setCurrentShift(cs)
  setCoupons(co);setAudit(a);setSettings(st);setFoodCost(fc);setStations(ks);setDeals(de);setTransfers(tr)
 }
 useEffect(()=>{load().catch(e=>alert(e.message))},[])

 const post=async(path:string,body:any)=>{await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});await load()}
 const avg=report.orders?Number(report.sales||0)/Number(report.orders):0
 const lowStock=inventory.filter(x=>x.low).length
 const openOrders=orders.filter(o=>!['completed','cancelled','refunded'].includes(o.status)).length
 const todayRecent=orders.slice(0,8)
 const cashPct=report.sales?Math.min(100,(report.cash/report.sales)*100):0
 const cardPct=report.sales?Math.min(100,(report.card/report.sales)*100):0

 const saveImage=async(item:any,file:File)=>{
   const reader=new FileReader()
   reader.onload=async()=>{await api(`/admin/menu/${item.id}/image`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_data:String(reader.result||'')})});await load()}
   reader.readAsDataURL(file)
 }
 const setPermissions=async(s:any)=>{
   const all=[
    'cashier_access','waiter_access','kitchen_access','tables_access','display_access',
    'admin_access','refund','void','discount','shift_close','day_close','inventory',
    'reports','expenses','printer','customers','suppliers'
   ]
   const current=new Set(s.permissions||[])
   const chosen:string[]=[]
   for(const p of all){
     if(confirm(`${s.name}: allow ${p.replaceAll('_',' ')}?`)) chosen.push(p)
   }
   await api(`/staff/${s.id}/permissions`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({permissions:chosen})})
   await load()
 }
 const manageSizes=async(item:any)=>{
   const name=prompt(`Add size for ${item.name} (example: Small, Medium, Large)`)
   if(!name)return
   const finalPrice=prompt(`Final price for ${name}`,String(item.price))
   if(finalPrice===null)return
   await post('/sizes',{menu_item_id:item.id,name,price_delta:(+finalPrice||0)-Number(item.price),active:true})
 }
 const removeSize=async(id:number)=>{await api('/sizes/'+id,{method:'DELETE'});await load()}
 const addMenu=()=>post('/admin/menu',{...menuForm,price:+menuForm.price||0,sku:'',active:true}).then(()=>setMenuForm({name:'',category:'General',price:'',barcode:''}))
 const delMenu=async(id:number)=>{if(confirm('Disable this item?')){await api('/admin/menu/'+id,{method:'DELETE'});await load()}}
 const addInv=()=>post('/inventory',{...invForm,qty:+invForm.qty||0,min_qty:0,cost:0}).then(()=>setInvForm({name:'',unit:'pcs',qty:''}))
 const adjustInv=async(i:any)=>{const q=prompt('New quantity',String(i.qty));if(q===null)return;await api('/inventory/'+i.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({qty:+q||0,reason:'Manual stock count'})});await load()}
 const waste=async(i:any)=>{const q=prompt('Wastage quantity');if(!q)return;await post('/wastage',{inventory_item_id:i.id,qty:+q,reason:prompt('Reason')||'Wastage'})}
 const addStaff=()=>post('/staff',{...staffForm,permissions:[],active:true}).then(()=>setStaffForm({name:'',role:'cashier',pin:''}))
 const addCust=()=>post('/customers',custForm).then(()=>setCustForm({name:'',phone:'',address:''}))
 const addSup=()=>post('/suppliers',supForm).then(()=>setSupForm({name:'',phone:'',email:''}))
 const addExpense=()=>post('/expenses',{...expForm,amount:+expForm.amount||0}).then(()=>setExpForm({title:'',amount:'',category:'General'}))
 const addCoupon=()=>post('/coupons',{...couponForm,value:+couponForm.value||0,active:true}).then(()=>setCouponForm({code:'',discount_type:'fixed',value:''}))
 const purchase=async()=>{if(!inventory.length)return alert('Add inventory first');const inv=prompt('Inventory item ID',String(inventory[0].id));const qty=prompt('Quantity','1');const cost=prompt('Unit cost','0');if(!inv||!qty)return;await post('/purchases',{supplier_id:null,items:[{inventory_item_id:+inv,qty:+qty,cost:+cost||0}]})}
 const voidOrder=async(o:any)=>{const pin=prompt('Manager/Admin PIN');if(!pin)return;try{await post(`/orders/${o.id}/void`,{manager_pin:pin,reason:prompt('Void reason')||''})}catch(e:any){alert(e.message)}}
 const refund=async(o:any)=>{const pin=prompt('Manager/Admin PIN');if(!pin)return;const amt=prompt(`Refund amount (max ${o.total-(o.refund_amount||0)})`,String(o.total-(o.refund_amount||0)));if(!amt)return;try{await post(`/orders/${o.id}/refund`,{manager_pin:pin,amount:+amt,reason:prompt('Reason')||''})}catch(e:any){alert(e.message)}}
 const cashMove=async(type:'in'|'out')=>{if(!currentShift)return alert('No open shift');const amt=prompt(`Cash ${type} amount`);if(!amt)return;await post(`/shifts/${currentShift.id}/cash`,{movement_type:type,amount:+amt,reason:prompt('Reason')||''})}
 const closeShift=async()=>{if(!currentShift)return;const actual=prompt(`Expected ${currentShift.expected_cash}. Actual cash?`);if(actual===null)return;const pin=prompt('Manager/Admin PIN');if(!pin)return;try{const r:any=await api(`/shifts/${currentShift.id}/close`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actual_cash:+actual||0,staff_pin:pin})});alert(`Shift closed. Difference ${r.difference}`);await load()}catch(e:any){alert(e.message)}}
 const closeDay=async()=>{const pin=prompt('Manager/Admin PIN');if(!pin)return;try{const r:any=await api('/day-close',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});alert(`Day closed. Sales ${r.sales}`);await load()}catch(e:any){alert(e.message)}}
 const saveSettings=async()=>{await api('/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});alert('Settings saved');await load()}
 const testPrinter=async()=>{try{const native=!!(window as any).AndroidPrinter;if(!native){const h=await fetch(PRINT_BRIDGE+'/health');if(!h.ok)throw Error('Printer bridge not running')}await sendToIpPrinter({id:'TEST',order_type:'test',payment_method:'cash',subtotal:0,discount:0,vat:0,total:0,items:[{qty:1,name:'MAHI POS TEST',unit_price:0}]},settings);alert('Test print sent')}catch(e:any){alert(e.message)}}

 const groups=['MAIN','MANAGE','INSIGHTS','SYSTEM']

 return <Shell title="Admin Dashboard" subtitle="Restaurant performance and operations">
  <div className="pro-admin-layout">
   <aside className="pro-admin-nav">
    {groups.map(g=><div key={g} className="pro-nav-group">
      <small>{g}</small>
      {tabs.filter(t=>t.group===g).map(t=><button key={t.key} className={tab===t.key?'active':''} onClick={()=>setTab(t.key)}><i>{t.icon}</i><span>{t.label}</span></button>)}
    </div>)}
   </aside>

   <section className="pro-admin-content">
    {tab==='dashboard'&&<>
      <div className="pro-page-head">
       <div><h2>Today at a glance</h2><p>Live business performance</p></div>
       <div className="pro-head-actions">
        <button className="secondary-btn" onClick={()=>setTab('orders')}>View Orders</button>
        <button className="primary-btn" onClick={()=>setTab('reports')}>Open Reports</button>
       </div>
      </div>

      <DayPartsSalesCard settings={settings} onSettingsChange={setSettings} onSave={saveSettings}/>
      <div className="pro-stat-grid">
       <Stat label="Net Sales" value={money(report.sales)} sub={`${report.orders||0} orders`} icon="↗" tone="blue"/>
       <Stat label="Open Orders" value={openOrders} sub="Live in system" icon="▤" tone="purple"/>
       <Stat label="Average Order" value={money(avg)} sub="Per ticket" icon="◎" tone="teal"/>
       <Stat label="VAT" value={money(report.vat)} sub="Collected today" icon="%" tone="orange"/>
       <Stat label="Cash" value={money(report.cash)} sub="Cash payments" icon="▣" tone="green"/>
       <Stat label="Card" value={money(report.card)} sub="Card payments" icon="▭" tone="indigo"/>
       <Stat label="Refunds" value={money(report.refunds)} sub="Today refunds" icon="↶" tone="red"/>
       <Stat label="Expenses" value={money(report.expenses)} sub="Petty cash / costs" icon="↓" tone="gray"/>
      </div>

      <div className="pro-dashboard-grid">
       <div className="pro-card pro-span-2">
        <div className="pro-card-head"><div><h3>Recent Orders</h3><p>Latest transactions</p></div><button onClick={()=>setTab('orders')}>View all</button></div>
        <div className="pro-table">
         <div className="pro-tr pro-th"><span>Order</span><span>Type</span><span>Status</span><span>Payment</span><span>Total</span></div>
         {todayRecent.map(o=><div className="pro-tr" key={o.id}>
          <span><b>#{o.id}</b><small>{orderTime(o.created_at)}</small></span>
          <span className="cap">{o.order_type}</span>
          <span><em className={`status-badge ${o.status}`}>{o.status}</em></span>
          <span className="cap">{o.payment_method}</span>
          <span><b>{money(o.total)}</b></span>
         </div>)}
        </div>
       </div>

       <div className="pro-card">
        <div className="pro-card-head"><div><h3>Shift Status</h3><p>Cashier control</p></div></div>
        {currentShift?<div className="shift-status-card open">
          <div className="shift-badge">OPEN</div><strong>Shift #{currentShift.id}</strong>
          <div className="shift-money"><span>Opening</span><b>{money(currentShift.opening_cash)}</b></div>
          <div className="shift-money"><span>Expected Cash</span><b>{money(currentShift.expected_cash)}</b></div>
          <button onClick={()=>setTab('shifts')}>Manage Shift</button>
        </div>:<div className="shift-status-card closed"><div className="shift-badge">CLOSED</div><strong>No active shift</strong><p>Cashier must open a shift before sales.</p></div>}
       </div>

       <div className="pro-card">
        <div className="pro-card-head"><div><h3>Payments</h3><p>Today split</p></div></div>
        <div className="pay-breakdown">
         <div><span>Cash</span><b>{money(report.cash)}</b></div><div className="bar"><i style={{width:`${cashPct}%`}}/></div>
         <div><span>Card</span><b>{money(report.card)}</b></div><div className="bar alt"><i style={{width:`${cardPct}%`}}/></div>
        </div>
       </div>

       <div className="pro-card">
        <div className="pro-card-head"><div><h3>Operations</h3><p>Current status</p></div></div>
        <div className="pro-quick-grid">
         <div><span>Menu Items</span><b>{menu.length}</b></div>
         <div><span>Low Stock</span><b className={lowStock?'danger-text':''}>{lowStock}</b></div>
         <div><span>Customers</span><b>{customers.length}</b></div>
         <div><span>Staff</span><b>{staff.length}</b></div>
         <div><span>Kitchen Stations</span><b>{stations.length}</b></div>
         <div><span>Deals</span><b>{deals.length}</b></div>
        </div>
       </div>

       <div className="pro-card">
        <div className="pro-card-head"><div><h3>Low Stock</h3><p>Needs attention</p></div><button onClick={()=>setTab('inventory')}>Inventory</button></div>
        <div className="low-stock-list">
         {inventory.filter(x=>x.low).slice(0,6).map(i=><div key={i.id}><span><b>{i.name}</b><small>{i.qty} {i.unit} remaining</small></span><em>LOW</em></div>)}
         {!lowStock&&<div className="all-good">✓ All inventory levels look healthy</div>}
        </div>
       </div>
      </div>
    </>}


    {tab==='control'&&<>
      <div className="pro-page-head"><div><h2>Admin Control Center</h2><p>Control the complete POS from one place</p></div><button className="primary-btn" onClick={saveSettings}>Save All Controls</button></div>

      <div className="control-master">
       <div className={`master-switch ${settings.app_enabled===false?'off':'on'}`}>
        <div><strong>Entire POS Application</strong><span>{settings.app_enabled===false?'DISABLED':'ACTIVE'}</span><small>Turn the whole POS application on/off</small></div>
        <input type="checkbox" checked={settings.app_enabled!==false} onChange={e=>setSettings({...settings,app_enabled:e.target.checked})}/>
       </div>
       <div className={`master-switch ${settings.shop_open===false?'off':'on'}`}>
        <div><strong>Restaurant Ordering</strong><span>{settings.shop_open===false?'CLOSED':'OPEN'}</span><small>Close ordering without disabling Admin</small></div>
        <input type="checkbox" checked={settings.shop_open!==false} onChange={e=>setSettings({...settings,shop_open:e.target.checked})}/>
       </div>
      </div>

      <div className="control-section-grid">
       <div className="control-card"><h3>Tax & Checkout</h3>
        <label><span><b>VAT</b><small>Show and calculate VAT</small></span><input type="checkbox" checked={settings.vat_enabled!==false} onChange={e=>setSettings({...settings,vat_enabled:e.target.checked})}/></label><label><span><b>VAT Inclusive Pricing</b><small>Menu price is final price; VAT is extracted inside it</small></span><input type="checkbox" checked={settings.vat_inclusive!==false} onChange={e=>setSettings({...settings,vat_inclusive:e.target.checked})}/></label>
        <label><span><b>Discounts</b><small>Cashier discount field</small></span><input type="checkbox" checked={settings.allow_discounts!==false} onChange={e=>setSettings({...settings,allow_discounts:e.target.checked})}/></label>
        <label><span><b>Coupons</b><small>Coupon code support</small></span><input type="checkbox" checked={settings.allow_coupons!==false} onChange={e=>setSettings({...settings,allow_coupons:e.target.checked})}/></label>
        <label><span><b>Split Payment</b><small>Cash + card payments</small></span><input type="checkbox" checked={settings.allow_split_payment!==false} onChange={e=>setSettings({...settings,allow_split_payment:e.target.checked})}/></label>
       </div>

       <div className="control-card"><h3>Order Types</h3>
        <label><span><b>Takeaway</b><small>Always available on Cashier</small></span><input type="checkbox" checked={true} disabled/></label>
        <label><span><b>Delivery</b><small>Admin can show/hide Delivery on Cashier</small></span><input type="checkbox" checked={settings.allow_delivery!==false} onChange={e=>setSettings({...settings,allow_delivery:e.target.checked})}/></label>
        <label><span><b>Hold / Recall</b></span><input type="checkbox" checked={settings.allow_hold_orders!==false} onChange={e=>setSettings({...settings,allow_hold_orders:e.target.checked})}/></label>
       </div>
      </div>

      <div className="control-note">Staff access is controlled from <b>Staff → Permissions</b>. Menu pictures are controlled from <b>Menu → Photo</b>. Printer, TRN and receipt settings are controlled from <b>Printer & Shop</b>.</div>
    </>}


    {tab==='orders'&&<>
      <div className="pro-page-head"><div><h2>Orders</h2><p>Manage refunds, voids and order status</p></div></div>
      <div className="pro-card"><div className="pro-table six">
       <div className="pro-tr pro-th"><span>Order</span><span>Time</span><span>Type</span><span>Status</span><span>Payment</span><span>Total / Actions</span></div>
       {orders.map(o=><div className="pro-tr" key={o.id}><span><b>#{o.id}</b></span><span>{orderTime(o.created_at)}</span><span className="cap">{o.order_type}</span><span><em className={`status-badge ${o.status}`}>{o.status}</em></span><span className="cap">{o.payment_method}</span><span><b>{money(o.total)}</b><div className="tiny-actions"><button onClick={()=>refund(o)}>Refund</button><button onClick={()=>voidOrder(o)}>Void</button></div></span></div>)}
      </div></div>
    </>}

    {tab==='shifts'&&<>
      <div className="pro-page-head"><div><h2>Shift & Day Closing</h2><p>Cash reconciliation and closing control</p></div>
       <div className="pro-head-actions"><button className="secondary-btn" onClick={()=>cashMove('in')}>Cash In</button><button className="secondary-btn" onClick={()=>cashMove('out')}>Cash Out</button><button className="primary-btn" onClick={closeShift}>Close Shift</button><button className="primary-btn" onClick={closeDay}>Close Day</button></div>
      </div>
      {currentShift&&<div className="pro-stat-grid compact-stats"><Stat label="Opening Cash" value={money(currentShift.opening_cash)} icon="▣"/><Stat label="Cash Sales" value={money(currentShift.cash_sales)} icon="↗"/><Stat label="Card Sales" value={money(currentShift.card_sales)} icon="▭"/><Stat label="Expected Cash" value={money(currentShift.expected_cash)} icon="◎"/></div>}
      <div className="pro-card"><div className="pro-table six"><div className="pro-tr pro-th"><span>Shift</span><span>Opened</span><span>Status</span><span>Expected</span><span>Actual</span><span>Difference</span></div>{shifts.map(s=><div className="pro-tr" key={s.id}><span><b>#{s.id}</b></span><span>{orderTime(s.opened_at)}</span><span><em className={`status-badge ${s.status==='open'?'ready':'completed'}`}>{s.status}</em></span><span>{money(s.expected_cash)}</span><span>{s.actual_cash==null?'—':money(s.actual_cash)}</span><span>{s.difference==null?'—':money(s.difference)}</span></div>)}</div></div>
    </>}

    {tab==='menu'&&<>
      <div className="pro-page-head"><div><h2>Menu Management</h2><p>Products, categories, pricing and barcode</p></div></div>
      <div className="pro-form-card"><input placeholder="Item name" value={menuForm.name} onChange={e=>setMenuForm({...menuForm,name:e.target.value})}/><input placeholder="Category" value={menuForm.category} onChange={e=>setMenuForm({...menuForm,category:e.target.value})}/><input type="number" placeholder="Price" value={menuForm.price} onChange={e=>setMenuForm({...menuForm,price:e.target.value})}/><input placeholder="Barcode" value={menuForm.barcode} onChange={e=>setMenuForm({...menuForm,barcode:e.target.value})}/><button className="primary-btn" onClick={addMenu}>Add Item</button></div>
      <div className="pro-product-grid">{menu.map(i=><article key={i.id}><div className="pro-product-icon">{i.image?<img src={i.image} alt={i.name}/>:i.name[0]}</div><div><small>{i.category}</small><strong>{i.name}</strong><b>{money(i.price)}</b><em>{settings?.vat_enabled!==false&&settings?.vat_inclusive!==false?`VAT inside ${money(vatInside(i.price))}`:(i.barcode||'No barcode')}</em></div><div className="product-actions"><label className="image-upload-btn">Photo<input type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&saveImage(i,e.target.files[0])}/></label><button className="size-manage-btn" onClick={()=>manageSizes(i)}>+ Size</button><button onClick={()=>delMenu(i.id)}>Disable</button></div>{i.sizes?.length>0&&<div className="admin-size-list">{i.sizes.filter((s:any)=>s.active!==false).map((s:any)=><button key={s.id} onClick={()=>removeSize(s.id)}>{s.name} · {money(i.price+s.price_delta)} ×</button>)}</div>}</article>)}</div>
    </>}

    {tab==='inventory'&&<>
      <div className="pro-page-head"><div><h2>Inventory</h2><p>Stock count, adjustments and wastage</p></div></div>
      <div className="pro-form-card"><input placeholder="Stock item" value={invForm.name} onChange={e=>setInvForm({...invForm,name:e.target.value})}/><input placeholder="Unit" value={invForm.unit} onChange={e=>setInvForm({...invForm,unit:e.target.value})}/><input type="number" placeholder="Quantity" value={invForm.qty} onChange={e=>setInvForm({...invForm,qty:e.target.value})}/><button className="primary-btn" onClick={addInv}>Add Stock</button></div>
      <div className="pro-card"><div className="pro-table"><div className="pro-tr pro-th"><span>Item</span><span>On Hand</span><span>Minimum</span><span>Status</span><span>Actions</span></div>{inventory.map(i=><div className="pro-tr" key={i.id}><span><b>{i.name}</b><small>{i.unit}</small></span><span>{i.qty} {i.unit}</span><span>{i.min_qty}</span><span>{i.low?<em className="status-badge cancelled">Low</em>:<em className="status-badge ready">Healthy</em>}</span><span><div className="tiny-actions"><button onClick={()=>adjustInv(i)}>Count</button><button onClick={()=>waste(i)}>Waste</button></div></span></div>)}</div></div>
    </>}

    {tab==='customers'&&<>
      <div className="pro-page-head"><div><h2>Customers</h2><p>CRM, contact details and loyalty</p></div></div>
      <div className="pro-form-card"><input placeholder="Name" value={custForm.name} onChange={e=>setCustForm({...custForm,name:e.target.value})}/><input placeholder="Phone" value={custForm.phone} onChange={e=>setCustForm({...custForm,phone:e.target.value})}/><input placeholder="Address" value={custForm.address} onChange={e=>setCustForm({...custForm,address:e.target.value})}/><button className="primary-btn" onClick={addCust}>Add Customer</button></div>
      <div className="pro-card"><div className="pro-table"><div className="pro-tr pro-th"><span>Customer</span><span>Phone</span><span>Address</span><span>Points</span></div>{customers.map(c=><div className="pro-tr" key={c.id}><span><b>{c.name}</b></span><span>{c.phone||'—'}</span><span>{c.address||'—'}</span><span><b>{Math.round(c.points||0)}</b></span></div>)}</div></div>
    </>}

    {tab==='suppliers'&&<>
      <div className="pro-page-head"><div><h2>Suppliers & Purchases</h2><p>Supplier records and stock receiving</p></div><button className="primary-btn" onClick={purchase}>Receive Purchase</button></div>
      <div className="pro-form-card"><input placeholder="Supplier name" value={supForm.name} onChange={e=>setSupForm({...supForm,name:e.target.value})}/><input placeholder="Phone" value={supForm.phone} onChange={e=>setSupForm({...supForm,phone:e.target.value})}/><input placeholder="Email" value={supForm.email} onChange={e=>setSupForm({...supForm,email:e.target.value})}/><button className="primary-btn" onClick={addSup}>Add Supplier</button></div>
      <div className="pro-dashboard-grid"><div className="pro-card"><div className="pro-card-head"><h3>Suppliers</h3></div>{suppliers.map(s=><div className="simple-row" key={s.id}><span><b>{s.name}</b><small>{s.phone}</small></span><span>{s.email}</span></div>)}</div><div className="pro-card"><div className="pro-card-head"><h3>Recent Purchases</h3></div>{purchases.slice(0,20).map(p=><div className="simple-row" key={p.id}><span>Purchase #{p.id}</span><b>{money(p.total)}</b></div>)}</div></div>
    </>}

    {tab==='expenses'&&<>
      <div className="pro-page-head"><div><h2>Expenses</h2><p>Petty cash and operating costs</p></div></div>
      <div className="pro-form-card"><input placeholder="Expense" value={expForm.title} onChange={e=>setExpForm({...expForm,title:e.target.value})}/><input type="number" placeholder="Amount" value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})}/><input placeholder="Category" value={expForm.category} onChange={e=>setExpForm({...expForm,category:e.target.value})}/><button className="primary-btn" onClick={addExpense}>Add Expense</button></div>
      <div className="pro-card">{expenses.map(e=><div className="simple-row" key={e.id}><span><b>{e.title}</b><small>{e.category}</small></span><b>{money(e.amount)}</b></div>)}</div>
    </>}

    {tab==='staff'&&<>
      <div className="pro-page-head"><div><h2>Staff & Access</h2><p>Roles, PIN and team management</p></div></div>
      <div className="pro-form-card"><input placeholder="Staff name" value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})}/><select value={staffForm.role} onChange={e=>setStaffForm({...staffForm,role:e.target.value})}><option>cashier</option><option>waiter</option><option>kitchen</option><option>manager</option><option>admin</option></select><input placeholder="PIN" value={staffForm.pin} onChange={e=>setStaffForm({...staffForm,pin:e.target.value})}/><button className="primary-btn" onClick={addStaff}>Add Staff</button></div>
      <div className="pro-staff-grid">{staff.map(s=><article key={s.id}><div className="pro-avatar">{s.name[0]}</div><strong>{s.name}</strong><span>{s.role}</span><small>PIN {s.pin}</small><button className="staff-permission-btn" onClick={()=>setPermissions(s)}>Permissions</button></article>)}</div>
    </>}

    {tab==='reports'&&<>
      <VatReportCard />

      <div className="pro-page-head"><div><h2>Reports</h2><p>Sales and payment performance</p></div></div>
      <div className="pro-report-hero"><div><span>Today's Net Sales</span><strong>{money(report.sales)}</strong><small>{report.orders||0} orders</small></div><div className="pay-breakdown"><div><span>Cash</span><b>{money(report.cash)}</b></div><div className="bar"><i style={{width:`${cashPct}%`}}/></div><div><span>Card</span><b>{money(report.card)}</b></div><div className="bar alt"><i style={{width:`${cardPct}%`}}/></div></div></div>
      
      <div className="pro-card staff-sales-card">
        <div className="pro-card-head"><div><h3>Sales by Staff</h3><p>Orders are tagged to the logged-in cashier/staff member</p></div></div>
        {Object.values(orders.reduce((acc:any,o:any)=>{
          const name=o.waiter||'Unknown'
          if(!acc[name])acc[name]={name,total:0,orders:0,cash:0,card:0}
          acc[name].total+=Number(o.total||0)-Number(o.refund_amount||0)
          acc[name].orders+=1
          acc[name].cash+=Number(o.cash_paid||0)
          acc[name].card+=Number(o.card_paid||0)
          return acc
        },{})).map((x:any)=><div className="simple-row" key={x.name}><span><b>{x.name}</b><small>{x.orders} orders · Cash {money(x.cash)} · Card {money(x.card)}</small></span><b>{money(x.total)}</b></div>)}
      </div>
<div className="pro-stat-grid compact-stats"><Stat label="VAT" value={money(report.vat)} icon="%"/><Stat label="Discounts" value={money(report.discounts)} icon="−"/><Stat label="Refunds" value={money(report.refunds)} icon="↶"/><Stat label="After Expenses" value={money(report.net_after_expenses)} icon="◎"/></div>
    </>}

    {tab==='coupons'&&<>
      <div className="pro-page-head"><div><h2>Coupons & Promotions</h2><p>Discount codes and offers</p></div></div>
      <div className="pro-form-card"><input placeholder="Code" value={couponForm.code} onChange={e=>setCouponForm({...couponForm,code:e.target.value.toUpperCase()})}/><select value={couponForm.discount_type} onChange={e=>setCouponForm({...couponForm,discount_type:e.target.value})}><option value="fixed">Fixed AED</option><option value="percent">Percent %</option></select><input type="number" placeholder="Value" value={couponForm.value} onChange={e=>setCouponForm({...couponForm,value:e.target.value})}/><button className="primary-btn" onClick={addCoupon}>Add Coupon</button></div>
      <div className="pro-card">{coupons.map(c=><div className="simple-row" key={c.id}><span><b>{c.code}</b></span><span>{c.discount_type} · {c.value}</span></div>)}</div>
    </>}

    {tab==='audit'&&<>
      <div className="pro-page-head"><div><h2>Audit Log</h2><p>Sensitive actions and history</p></div></div>
      <div className="pro-card">{audit.slice(0,200).map(a=><div className="audit-row" key={a.id}><time>{a.created_at.slice(0,19).replace('T',' ')}</time><div><b>{a.action}</b><span>{a.entity} #{a.entity_id}</span><small>{a.details}</small></div></div>)}</div>
    </>}

    {tab==='advanced'&&<>
      <div className="pro-page-head"><div><h2>Advanced Operations</h2><p>Food cost, kitchen routing, transfers and deals</p></div></div>
      <div className="pro-dashboard-grid">
       <div className="pro-card"><div className="pro-card-head"><h3>Food Cost</h3></div>{foodCost.slice(0,25).map(f=><div className="simple-row" key={f.menu_item_id}><span>{f.name}</span><b>{money(f.ingredient_cost)} · {f.food_cost_percent}%</b></div>)}</div>
       <div className="pro-card"><div className="pro-card-head"><h3>Kitchen Stations</h3><button onClick={async()=>{const name=prompt('Station name');if(!name)return;const cats=(prompt('Categories comma separated')||'').split(',').map(x=>x.trim()).filter(Boolean);await post('/kitchen-stations',{name,categories:cats,printer_id:null,active:true})}}>Add</button></div>{stations.map(s=><div className="simple-row" key={s.id}><b>{s.name}</b><span>{s.categories.join(', ')||'All'}</span></div>)}</div>
       <div className="pro-card"><div className="pro-card-head"><h3>Stock Transfers</h3><button onClick={async()=>{const id=prompt('Inventory item ID');const q=prompt('Qty');if(!id||!q)return;await post('/stock-transfer',{inventory_item_id:+id,qty:+q,from_location:prompt('From','Main')||'Main',to_location:prompt('To','Branch')||'Branch'})}}>Transfer</button></div>{transfers.slice(0,20).map(t=><div className="simple-row" key={t.id}><span>Item #{t.inventory_item_id} · {t.qty}</span><b>{t.from_location} → {t.to_location}</b></div>)}</div>
       <div className="pro-card"><div className="pro-card-head"><h3>Deals / Combos</h3><button onClick={async()=>{const name=prompt('Deal name');const price=prompt('Deal price');if(!name||!price)return;await post('/deals',{name,price:+price,rules:[],active:true})}}>Add</button></div>{deals.map(d=><div className="simple-row" key={d.id}><span>{d.name}</span><b>{money(d.price)}</b></div>)}</div>
      </div>
    </>}

    {tab==='printer'&&<>
      <div className="pro-page-head"><div><h2>Printer & Shop Settings</h2><p>Receipt details and network printer</p></div></div>
      <div className="pro-settings-grid">
       <div className="pro-settings-card"><div className="settings-icon">🏪</div><h3>Restaurant Details</h3><label>Shop Name<input value={settings.shop_name||''} onChange={e=>setSettings({...settings,shop_name:e.target.value})}/></label><label>Phone<input value={settings.shop_phone||''} onChange={e=>setSettings({...settings,shop_phone:e.target.value})}/></label><label>Address<input value={settings.shop_address||''} onChange={e=>setSettings({...settings,shop_address:e.target.value})}/></label><label>TRN<input value={settings.trn||''} onChange={e=>setSettings({...settings,trn:e.target.value})}/></label><label>VAT %<input type="number" value={settings.vat_percent||5} onChange={e=>setSettings({...settings,vat_percent:+e.target.value})}/></label><label>Receipt Footer<input value={settings.receipt_footer||''} onChange={e=>setSettings({...settings,receipt_footer:e.target.value})}/></label></div>
       <div className="pro-settings-card"><div className="settings-icon">🖨️</div><h3>Receipt Printer</h3><label>Printer IP<input placeholder="192.168.1.50" value={settings.printer_ip||''} onChange={e=>setSettings({...settings,printer_ip:e.target.value})}/></label><label>Port<input type="number" value={settings.printer_port||9100} onChange={e=>setSettings({...settings,printer_port:+e.target.value})}/></label><label className="pro-toggle"><span><b>Auto Print</b><small>Print receipt after order</small></span><input type="checkbox" checked={!!settings.auto_print} onChange={e=>setSettings({...settings,auto_print:e.target.checked})}/></label><label className="pro-toggle"><span><b>Auto Cash Drawer</b><small>Open drawer after cash sale</small></span><input type="checkbox" checked={settings.auto_cash_drawer!==false} onChange={e=>setSettings({...settings,auto_cash_drawer:e.target.checked})}/></label><label className="pro-toggle"><span><b>Require Open Shift</b><small>Cashier must open shift</small></span><input type="checkbox" checked={!!settings.require_shift} onChange={e=>setSettings({...settings,require_shift:e.target.checked})}/></label><label className="pro-toggle"><span><b>Kitchen Sound</b><small>New order alert</small></span><input type="checkbox" checked={!!settings.kitchen_sound} onChange={e=>setSettings({...settings,kitchen_sound:e.target.checked})}/></label><div className="button-row"><button className="secondary-btn" onClick={testPrinter}>Test Printer</button><button className="primary-btn" onClick={saveSettings}>Save Settings</button></div></div>
      </div>
    </>}
   </section>
  </div>
 </Shell>
}

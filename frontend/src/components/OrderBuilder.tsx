import React, {useEffect, useMemo, useState} from 'react'
import {api, money, sendToIpPrinter, openCashDrawer} from '../api'
import type {MenuItem, PosTable, Staff, Settings} from '../types'

type Customer={id:number;name:string;phone:string;address:string;points:number}
type Shift={id:number;opening_cash:number;expected_cash:number;cash_sales:number;card_sales:number}

export default function OrderBuilder({waiterMode=false,cashierCompact=false}:{waiterMode?:boolean;cashierCompact?:boolean}){
  const loggedUser=(()=>{try{return JSON.parse(localStorage.getItem('mahi_user')||'null')}catch{return null}})()
  const isCashier=loggedUser?.role==='cashier'||loggedUser?.role==='admin'||loggedUser?.role==='manager'
  const isWaiter=loggedUser?.role==='waiter'||waiterMode

  const [menu,setMenu]=useState<MenuItem[]>([])
  const [tables,setTables]=useState<PosTable[]>([])
  const [staff,setStaff]=useState<Staff[]>([])
  const [customers,setCustomers]=useState<Customer[]>([])
  const [settings,setSettings]=useState<Settings|null>(null)
  const [shift,setShift]=useState<Shift|null>(null)
  const [pending,setPending]=useState<any[]>([])
  const [cart,setCart]=useState<Record<number,number>>({})
  const [mods,setMods]=useState<Record<number,number[]>>({})
  const [category,setCategory]=useState('')
  const [search,setSearch]=useState('')
  const [type,setType]=useState('takeaway')
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
  const [cashierMenuOpen,setCashierMenuOpen]=useState(false)
  const [toolsOpen,setToolsOpen]=useState(false)
  const [closingReport,setClosingReport]=useState<any>(null)
  const [shiftOpenModal,setShiftOpenModal]=useState(false)
  const [openingCashInput,setOpeningCashInput]=useState('0')
  const [shiftCloseModal,setShiftCloseModal]=useState(false)
  const [actualCashInput,setActualCashInput]=useState('')
  const [managerPinInput,setManagerPinInput]=useState('')
  const [sizePicker,setSizePicker]=useState<MenuItem|null>(null)
  const [selectedSizes,setSelectedSizes]=useState<Record<number,{id:number;name:string;price_delta:number}>>({})
  const [editingPendingId,setEditingPendingId]=useState<number|null>(null)

  const load=async()=>{
    const [m,st]=await Promise.all([api<MenuItem[]>('/menu'),api<Settings>('/settings')])
    setMenu(m);setSettings(st)
    const results=await Promise.allSettled([
      api<PosTable[]>('/tables'),api<Staff[]>('/staff'),api<Customer[]>('/customers'),
      api<Shift|null>('/shifts/current'),api<any[]>('/orders/pending-payment')
    ])
    if(results[0].status==='fulfilled')setTables(results[0].value)
    if(results[1].status==='fulfilled')setStaff(results[1].value)
    if(results[2].status==='fulfilled')setCustomers(results[2].value)
    if(results[3].status==='fulfilled')setShift(results[3].value)
    if(results[4].status==='fulfilled')setPending(results[4].value)
    else{console.error('Pending payment load failed',results[4].reason);setPending([])}
    if(isWaiter&&loggedUser?.id)setWaiterId(loggedUser.id)
  }

  useEffect(()=>{
    load().catch(console.error)
  },[])

  const categories=useMemo(
    ()=>Array.from(
      new Set(
        menu
          .map(x=>x.category)
          .filter(Boolean)
      )
    ),
    [menu]
  )

  useEffect(()=>{
    if(
      categories.length &&
      (!category || !categories.includes(category))
    ){
      setCategory(categories[0])
    }
  },[categories,category])

  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim()

    return menu.filter(i=>
      (!category || i.category===category) &&
      (
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.barcode===q
      )
    )
  },[menu,category,search])

  const cartLines=useMemo(
    ()=>menu.filter(i=>(cart[i.id]||0)>0),
    [menu,cart]
  )

  const subtotal=useMemo(()=>{
    return cartLines.reduce((sum,i)=>{
      const modTotal=(mods[i.id]||[])
        .map(id=>i.modifiers?.find(m=>m.id===id)?.price||0)
        .reduce((a,b)=>a+b,0)

      const sizeDelta=selectedSizes[i.id]?.price_delta||0

      return sum+
        (cart[i.id]||0)*
        (
          i.price+
          sizeDelta+
          modTotal
        )
    },0)
  },[cartLines,cart,mods,selectedSizes])

  const grossAfterDiscount=Math.max(0,subtotal-discount)

  const vatRate=
    settings?.vat_enabled===false
      ?0
      :Number(settings?.vat_percent??5)

  const vatInclusive=
    settings?.vat_inclusive!==false

  const vat=
    vatRate>0
      ?(
        vatInclusive
          ?grossAfterDiscount-(grossAfterDiscount/(1+vatRate/100))
          :grossAfterDiscount*(vatRate/100)
      )
      :0

  const taxable=
    vatInclusive
      ?grossAfterDiscount-vat
      :grossAfterDiscount

  const total=
    vatInclusive
      ?grossAfterDiscount
      :taxable+vat

  const qty=(id:number,d:number)=>{
    setCart(c=>({
      ...c,
      [id]:Math.max(
        0,
        (c[id]||0)+d
      )
    }))
  }

  const addProduct=(item:MenuItem)=>{
    if(item.sizes?.length){
      setSizePicker(item)
      return
    }

    qty(item.id,1)
  }

  const chooseSize=(
    item:MenuItem,
    size:{
      id:number
      name:string
      price_delta:number
    }
  )=>{
    setSelectedSizes(s=>({
      ...s,
      [item.id]:size
    }))

    qty(item.id,1)
    setSizePicker(null)
  }

  const toggleMod=(itemId:number,modId:number)=>{
    setMods(m=>{
      const a=m[itemId]||[]

      return {
        ...m,
        [itemId]:
          a.includes(modId)
            ?a.filter(x=>x!==modId)
            :[...a,modId]
      }
    })
  }


  const openShift=async()=>{
    setOpeningCashInput('0')
    setShiftOpenModal(true)
  }

  const confirmOpenShift=async()=>{
    try{
      const s:any=await api(
        '/shifts/open',
        {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            opening_cash:+openingCashInput||0,
            staff_id:loggedUser?.id||null
          })
        }
      )
      setShiftOpenModal(false)
      await load()
    }catch(e:any){
      alert(e.message)
    }
  }

  const closeShift=async()=>{
    if(!shift)return
    setActualCashInput(String(shift.expected_cash||0))
    setManagerPinInput('')
    setShiftCloseModal(true)
  }

  const confirmCloseShift=async()=>{
    if(!shift)return
    if(!managerPinInput.trim()){
      alert('Enter Admin / Manager PIN')
      return
    }

    try{
      const r:any=await api(
        `/shifts/${shift.id}/close`,
        {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            actual_cash:+actualCashInput||0,
            staff_pin:managerPinInput
          })
        }
      )

      setShiftCloseModal(false)
      setClosingReport(r)
      setCashierMenuOpen(false)
      await load()
    }catch(e:any){
      alert(e.message)
    }
  }

  const cashMove=async(kind:'in'|'out')=>{
    if(!shift){
      alert('Open shift first')
      return
    }

    const amount=prompt(
      kind==='in'
        ?'Cash In amount AED'
        :'Cash Out amount AED'
    )

    if(!amount)return

    const reason=prompt('Reason')||''

    try{
      await api(
        `/shifts/${shift.id}/cash`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            movement_type:kind,
            amount:+amount||0,
            reason
          })
        }
      )

      await load()

    }catch(e:any){
      alert(e.message)
    }
  }

  const addExpenseQuick=async()=>{
    const title=prompt('Expense name')
    if(!title)return

    const amount=prompt('Expense amount AED')
    if(!amount)return

    const category=
      prompt(
        'Category',
        'General'
      )||'General'

    try{
      await api(
        '/expenses',
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            title,
            amount:+amount||0,
            category
          })
        }
      )

    }catch(e:any){
      alert(e.message)
    }
  }

  const manualDrawer=async()=>{
    if(!settings)return

    try{
      await openCashDrawer(settings)

    }catch(e:any){
      alert(e.message)
    }
  }

  const syncMenu=async()=>{
    try{
      await api('/sync/menu',{method:'POST'})
      await load()
    }catch(e:any){
      alert(e.message)
    }
  }

  const logout=()=>{
    localStorage.removeItem('mahi_user')
    location.href='/login'
  }

  const addCustomer=async()=>{
    const name=prompt('Customer name')
    if(!name)return

    const phone=prompt('Phone')||''
    const address=prompt('Address')||''

    try{
      const r:any=await api(
        '/customers',
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            name,
            phone,
            address
          })
        }
      )

      await load()
      setCustomerId(r.id)

      if(address){
        setDeliveryAddress(address)
      }

    }catch(e:any){
      alert(e.message)
    }
  }

  const submit=async(hold=false)=>{
    const items=
      Object.entries(cart)
        .filter(([,q])=>q>0)
        .map(([id,q])=>({
          menu_item_id:+id,
          qty:q,
          size_id:selectedSizes[+id]?.id||null,
          modifier_ids:mods[+id]||[]
        }))

    if(!items.length){
      alert('Add items first')
      return
    }

    if(
      isCashier &&
      settings?.require_shift &&
      !shift
    ){
      alert('Open shift first')
      return
    }

    if(
      type==='delivery' &&
      !deliveryAddress.trim()
    ){
      alert('Enter delivery address')
      return
    }

    if(
      pay==='split' &&
      Math.abs(
        (cashPaid+cardPaid)-total
      )>.01
    ){
      alert('Cash + Card must equal total')
      return
    }

    setSaving(true)

    try{
      const created:any=await api(
        '/orders',
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            items,
            order_type:type,
            payment_method:pay,
            cash_paid:
              pay==='split'
                ?cashPaid
                :null,
            card_paid:
              pay==='split'
                ?cardPaid
                :null,
            table_id:null,
            waiter_id:
              loggedUser?.id||
              waiterId||
              null,
            customer_id:
              type==='delivery'
                ?customerId||null
                :null,
            shift_id:shift?.id||null,
            discount,
            coupon_code:coupon || '',
            delivery_address:
              type==='delivery'
                ?deliveryAddress
                :'',
            hold
          })
        }
      )

      setLastOrderId(created.id)
      setCart({})
      setMods({})
      setSelectedSizes({})
      setDiscount(0)
      setCashPaid(0)
      setCardPaid(0)
      setDeliveryAddress('')
      setCustomerId(undefined)

      // Kitchen printing is queued by the backend.
      // This works the same from Android, iPad, iPhone and Waiter.

      if(
        !hold &&
        pay==='cash' &&
        settings?.auto_cash_drawer!==false
      ){
        try{
          await openCashDrawer(settings)
        }catch(e:any){
          console.warn(
            'Drawer:',
            e.message
          )
        }
      }

      await load()

    }catch(e:any){
      alert(e.message)

    }finally{
      setSaving(false)
    }
  }

  const openPendingOrder=async(order:any)=>{
    try{
      const full:any=await api(`/orders/pending-payment/${order.id}`)

      const nextCart:Record<number,number>={}
      const nextMods:Record<number,number[]>={}
      const nextSizes:Record<number,{id:number;name:string;price_delta:number}>={}

      for(const line of full.items||[]){
        const menuId=Number(line.menu_item_id||line.id||0)
        if(!menuId)continue

        nextCart[menuId]=Number(line.qty||1)

        if(Array.isArray(line.modifier_ids)){
          nextMods[menuId]=line.modifier_ids.map((x:any)=>Number(x))
        }

        if(line.size_id){
          const menuItem=menu.find(x=>x.id===menuId)
          const size=menuItem?.sizes?.find((x:any)=>x.id===Number(line.size_id))
          if(size){
            nextSizes[menuId]={
              id:size.id,
              name:size.name,
              price_delta:Number(size.price_delta||0)
            }
          }
        }
      }

      setCart(nextCart)
      setMods(nextMods)
      setSelectedSizes(nextSizes)
      setType(full.order_type||'takeaway')
      setDiscount(Number(full.discount||0))
      setCustomerId(full.customer_id||undefined)
      setDeliveryAddress(full.delivery_address||'')
      setEditingPendingId(full.id)
      setPay('cash')
      setCashPaid(0)
      setCardPaid(0)
      setCashierMenuOpen(false)
    }catch(e:any){
      alert(e.message)
    }
  }

  const completePendingPayment=async()=>{
    if(!editingPendingId)return false

    if(
      pay==='split' &&
      Math.abs((cashPaid+cardPaid)-total)>.01
    ){
      alert('Cash + Card must equal total')
      return true
    }

    setSaving(true)

    try{
      await api(`/orders/${editingPendingId}/pay`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          payment_method:pay,
          cash_paid:pay==='split'?cashPaid:undefined,
          card_paid:pay==='split'?cardPaid:undefined
        })
      })

      if(
        pay==='cash' &&
        settings?.auto_cash_drawer!==false &&
        settings
      ){
        try{
          await openCashDrawer(settings)
        }catch(e:any){
          console.warn('Drawer:',e.message)
        }
      }

      setCart({})
      setMods({})
      setSelectedSizes({})
      setDiscount(0)
      setCashPaid(0)
      setCardPaid(0)
      setDeliveryAddress('')
      setCustomerId(undefined)
      setEditingPendingId(null)

      await load()
      return true
    }catch(e:any){
      alert(e.message)
      return true
    }finally{
      setSaving(false)
    }
  }

  const cancelHeld=async(id:number)=>{
    const pin=prompt('Admin / Manager PIN')
    if(!pin)return

    const reason=prompt('Cancel reason')||'Held order cancelled'

    try{
      await api(
        `/orders/${id}/void`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            manager_pin:pin,
            reason
          })
        }
      )

      await load()
    }catch(e:any){
      alert(e.message)
    }
  }

  const recall=async(id:number)=>{
    try{
      await api(
        `/orders/${id}/recall`,
        {
          method:'POST'
        }
      )

      await load()

    }catch(e:any){
      alert(e.message)
    }
  }

  if(
    isCashier &&
    settings?.require_shift &&
    !shift
  ){
    return (
      <div className="shift-opening-gate">
        <div className="shift-opening-card">
          <small>MAHI POS</small>
          <h1>Open Shift</h1>
          <p>Open the cash drawer shift before starting sales.</p>

          <button
            onClick={()=>{
              setOpeningCashInput('0')
              setShiftOpenModal(true)
            }}
          >
            OPEN SHIFT
          </button>

          <button
            className="shift-gate-logout"
            onClick={logout}
          >
            LOG OUT
          </button>
        </div>

        {shiftOpenModal&&(
          <div className="pos-big-modal-backdrop">
            <div className="pos-big-modal">

              <div className="pos-big-modal-head">
                <div>
                  <small>SHIFT CONTROL</small>
                  <h2>Open Shift</h2>
                </div>

                <button
                  onClick={()=>
                    setShiftOpenModal(false)
                  }
                >
                  ×
                </button>
              </div>

              <label className="pos-big-field">
                <span>Starting Cash</span>

                <div className="pos-big-money-input">
                  <b>AED</b>

                  <input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={openingCashInput}
                    onChange={e=>
                      setOpeningCashInput(
                        e.target.value
                      )
                    }
                  />
                </div>
              </label>

              <button
                className="pos-big-primary"
                onClick={confirmOpenShift}
              >
                CONFIRM OPEN SHIFT
              </button>

            </div>
          </div>
        )}
      </div>
    )
  }

  if(settings?.app_enabled===false){
    return (
      <div className="closed-screen">
        <div>
          <b>POS Disabled</b>
          <span>
            Admin has disabled the application.
          </span>
        </div>
      </div>
    )
  }

  if(settings?.shop_open===false){
    return (
      <div className="closed-screen">
        <div>
          <b>Shop Closed</b>
          <span>
            Admin has closed ordering.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`pos-workspace ${
        cashierCompact
          ?'cashier-clean-workspace'
          :''
      } card-${
        settings?.cashier_card_size||'auto'
      }`}
    >

      <div className="product-area">

        {cashierCompact&&isCashier&&(
          <div className="cashier-clean-head">

            <button
              className="hamburger-btn"
              onClick={()=>
                setCashierMenuOpen(true)
              }
            >
              ☰
            </button>

            <div
              className={`cashier-shift-mini ${
                shift?'open':'closed'
              }`}
            >
              <i></i>

              <span>
                {shift
                  ?`Shift #${shift.id} Open`
                  :'Shift Closed'}
              </span>
            </div>

            <button
              className={`pending-top-btn ${pending.length?'has-pending':''}`}
              onClick={()=>setCashierMenuOpen(true)}
            >
              PENDING PAYMENT {pending.length?`(${pending.length})`:''}
            </button>

            <div className="cashier-clock">
              {new Date().toLocaleDateString('en-GB')}
            </div>

          </div>
        )}

        {isCashier&&!cashierCompact&&(
          <div className="shift-strip">

            <div>
              {shift?(
                <>
                  <b>
                    Shift #{shift.id} OPEN
                  </b>

                  <span>
                    Expected cash {money(shift.expected_cash)}
                  </span>
                </>
              ):(
                <>
                  <b>No open shift</b>
                  <span>
                    Open shift before sales
                  </span>
                </>
              )}
            </div>

            {shift?(
              <button onClick={closeShift}>
                Close Shift
              </button>
            ):(
              <button onClick={openShift}>
                Open Shift
              </button>
            )}

          </div>
        )}

        <div className="pos-toolbar">

          <div className="segment">

            <button
              className={
                type==='takeaway'
                  ?'selected'
                  :''
              }
              onClick={()=>
                setType('takeaway')
              }
            >
              Takeaway
            </button>

            {settings?.allow_delivery!==false&&(
              <button
                className={
                  type==='delivery'
                    ?'selected'
                    :''
                }
                onClick={()=>
                  setType('delivery')
                }
              >
                Delivery
              </button>
            )}

          </div>

          {!cashierCompact&&(
            <input
              className="search-box"
              placeholder="Search products..."
              value={search}
              onChange={e=>
                setSearch(e.target.value)
              }
            />
          )}

          

          {isWaiter?(
            <div className="staff-fixed-pill">
              Waiter: {loggedUser?.name||'Current staff'}
            </div>
          ):(
            !cashierCompact&&(
              <select
                value={waiterId||''}
                onChange={e=>
                  setWaiterId(
                    +e.target.value||
                    undefined
                  )
                }
              >
                <option value="">
                  No waiter
                </option>

                {staff
                  .filter(s=>s.role==='waiter')
                  .map(s=>(
                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {s.name}
                    </option>
                  ))}
              </select>
            )
          )}

          {cashierCompact&&(
            <button
              className="cashier-tool-btn"
              onClick={()=>
                setToolsOpen(!toolsOpen)
              }
            >
              ⌕
            </button>
          )}

        </div>

        {cashierCompact&&toolsOpen&&(
          <div className="cashier-tools-panel">
            <input
              className="search-box"
              placeholder="Search menu..."
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
          </div>
        )}

        <div className="category-tabs">
          {categories.map(c=>(
            <button
              key={c}
              className={
                category===c
                  ?'active'
                  :''
              }
              onClick={()=>
                setCategory(c)
              }
            >
              {c}
            </button>
          ))}
        </div>

        <div className="product-grid">

          {filtered.map(item=>(
            <div
              className="product-card-wrap"
              key={item.id}
            >

              <button
                className="product-card"
                onClick={()=>
                  addProduct(item)
                }
              >

                <div className="product-photo">

                  {item.image?(
                    <img
                      src={item.image}
                      alt={item.name}
                    />
                  ):(
                    <span>
                      {item.name[0]}
                    </span>
                  )}

                </div>

                <div className="product-info">

                  <small>
                    {item.category}
                  </small>

                  <strong>
                    {item.name}
                  </strong>

                  <b>
                    {item.sizes?.length
                      ?`From ${money(
                          Math.min(
                            ...item.sizes.map(
                              s=>item.price+s.price_delta
                            )
                          )
                        )}`
                      :money(item.price)}
                  </b>

                </div>

                {(cart[item.id]||0)>0&&(
                  <em>
                    {cart[item.id]}
                  </em>
                )}

              </button>

              {(cart[item.id]||0)>0&&
              item.modifiers?.length?(
                <div className="modifier-mini">

                  {item.modifiers.map(m=>(
                    <label key={m.id}>

                      <input
                        type="checkbox"
                        checked={
                          (mods[item.id]||[])
                            .includes(m.id)
                        }
                        onChange={()=>
                          toggleMod(
                            item.id,
                            m.id
                          )
                        }
                      />

                      {m.name} +{m.price}

                    </label>
                  ))}

                </div>
              ):null}

            </div>
          ))}

        </div>

      </div>

      <aside className="order-panel">

        <div className="order-panel-head">

          <div>
            <span>
              Current order
            </span>

            <strong>
              {editingPendingId
                ?`Pending #${editingPendingId}`
                :type}
            </strong>
          </div>

          <button
            className="ghost-danger"
            onClick={()=>{
              setCart({})
              setMods({})
              setSelectedSizes({})
              setEditingPendingId(null)
            }}
          >
            Clear
          </button>

        </div>

        <div className="cart-lines">

          {!cartLines.length&&(
            <div className="empty-cart">

              <div>🧾</div>

              <strong>
                No items yet
              </strong>

              <span>
                Tap a product to add it
              </span>

            </div>
          )}

          {cartLines.map(i=>(
            <div
              className="cart-line"
              key={i.id}
            >

              <div className="cart-main">

                <strong>
                  {i.name}
                </strong>

                <small>
                  {selectedSizes[i.id]
                    ?`${selectedSizes[i.id].name} · ${
                        money(
                          i.price+
                          (selectedSizes[i.id]?.price_delta||0)
                        )
                      }`
                    :`${money(i.price)} each`}
                </small>

              </div>

              <div className="qty-stepper">

                <button
                  onClick={()=>
                    qty(i.id,-1)
                  }
                >
                  −
                </button>

                <b>
                  {cart[i.id]}
                </b>

                <button
                  onClick={()=>
                    qty(i.id,1)
                  }
                >
                  +
                </button>

              </div>

              <strong>
                {money(
                  (cart[i.id]||0)*
                  (
                    i.price+
                    (selectedSizes[i.id]?.price_delta||0)
                  )
                )}
              </strong>

            </div>
          ))}

        </div>

        <div className="order-summary">

          {type==='delivery'&&(
            <>
              <div className="customer-line">

                <select
                  value={customerId||''}
                  onChange={e=>
                    setCustomerId(
                      +e.target.value||
                      undefined
                    )
                  }
                >
                  <option value="">
                    No customer
                  </option>

                  {customers.map(c=>(
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                      {c.phone?` · ${c.phone}`:''}
                    </option>
                  ))}
                </select>

                <button onClick={addCustomer}>
                  +
                </button>

              </div>

              <input
                className="plain-input"
                placeholder="Delivery address"
                value={deliveryAddress}
                onChange={e=>
                  setDeliveryAddress(
                    e.target.value
                  )
                }
              />
            </>
          )}

          

          <div className="summary-row">

            <span>
              Subtotal
            </span>

            <b>
              {money(subtotal)}
            </b>

          </div>

          {settings?.vat_enabled!==false&&
          settings?.vat_inclusive!==false&&(
            <div className="summary-row vat-included-line">

              <span>
                VAT Included
              </span>

              <b></b>

            </div>
          )}

          {settings?.vat_enabled!==false&&
          settings?.vat_inclusive===false&&(
            <div className="summary-row">

              <span>
                VAT {vatRate}%
              </span>

              <b>
                {money(vat)}
              </b>

            </div>
          )}

          <div className="summary-row total">

            <span>
              Total
            </span>

            <b>
              {money(total)}
            </b>

          </div>

          {isCashier&&(
            <>

              {settings?.allow_hold_orders!==false&&(
                <button
                  className="secondary-button hold-kitchen-button"
                  onClick={()=>
                    submit(true)
                  }
                  disabled={saving}
                >
                  SEND TO KITCHEN
                </button>
              )}

              <div className="payment-switch">

                {[
                  'cash',
                  'card',
                  ...(
                    settings?.allow_split_payment===false
                      ?[]
                      :['split']
                  )
                ].map(x=>(
                  <button
                    key={x}
                    className={
                      pay===x
                        ?'active'
                        :''
                    }
                    onClick={()=>
                      setPay(x)
                    }
                  >
                    {x}
                  </button>
                ))}

              </div>

              {pay==='split'&&(
                <div className="split-pay">

                  <input
                    type="number"
                    placeholder="Cash"
                    value={cashPaid||''}
                    onChange={e=>
                      setCashPaid(
                        +e.target.value||0
                      )
                    }
                  />

                  <input
                    type="number"
                    placeholder="Card"
                    value={cardPaid||''}
                    onChange={e=>
                      setCardPaid(
                        +e.target.value||0
                      )
                    }
                  />

                </div>
              )}

              <button
                className="pay-button"
                onClick={async()=>{
                  if(editingPendingId){
                    await completePendingPayment()
                  }else{
                    await submit(false)
                  }
                }}
                disabled={saving}
              >
                {saving
                  ?'Saving...'
                  :editingPendingId
                    ?`COMPLETE PAYMENT #${editingPendingId} · ${money(total)}`
                    :`PAYMENT · ${money(total)}`}
              </button>

            </>
          )}

          {isWaiter&&(
            <button
              className="pay-button waiter-send"
              onClick={()=>
                submit(false)
              }
              disabled={saving}
            >
              {saving
                ?'Sending...'
                :'SEND ORDER'}
            </button>
          )}

        </div>

      </aside>

      {cashierCompact&&cashierMenuOpen&&(
        <div
          className="cashier-drawer-backdrop"
          onClick={()=>
            setCashierMenuOpen(false)
          }
        >

          <aside
            className="cashier-drawer-menu"
            onClick={e=>
              e.stopPropagation()
            }
          >

            <div className="cashier-drawer-title">

              <div>
                <strong>
                  Cashier Menu
                </strong>

                <span>
                  {loggedUser?.name||'Cashier'}
                </span>
              </div>

              <button
                onClick={()=>
                  setCashierMenuOpen(false)
                }
              >
                ×
              </button>

            </div>

            <section>

              <small>
                SHIFT & CASH
              </small>

              {!shift?(
                <button
                  onClick={()=>{
                    setCashierMenuOpen(false)
                    openShift()
                  }}
                >
                  ◷ Open Shift
                </button>
              ):(
                <>
                  <button
                    onClick={()=>{
                      setCashierMenuOpen(false)
                      closeShift()
                    }}
                  >
                    ◷ Close Shift
                  </button>

                  <button
                    onClick={()=>
                      cashMove('in')
                    }
                  >
                    ＋ Cash In
                  </button>

                  <button
                    onClick={()=>
                      cashMove('out')
                    }
                  >
                    − Cash Out
                  </button>
                </>
              )}

              {settings?.allow_discounts!==false&&(
                <button
                  onClick={()=>{
                    const value=prompt('Discount AED',String(discount||0))
                    if(value!==null)setDiscount(Math.max(0,+value||0))
                  }}
                >
                  % Discount {discount>0?`· AED ${discount.toFixed(2)}`:''}
                </button>
              )}

              <button
                onClick={addExpenseQuick}
              >
                ↓ Add Expense
              </button>

            </section>

            <section>

              <small>
                ORDERS
              </small>

              <button
                onClick={()=>{
                  setCashierMenuOpen(false)
                  setToolsOpen(true)
                }}
              >
                ⌕ Search Menu
              </button>

              {pending.length>0&&(
                <div className="drawer-held">

                  <b>
                    Pending Payment ({pending.length})
                  </b>

                  {pending.slice(0,8).map(h=>(
                    <div className="held-order-actions pending-order-actions" key={h.id}>
                      <button
                        className="pending-pay-btn"
                        onClick={()=>openPendingOrder(h)}
                      >
                        ORDER #{h.id} · {money(h.total)}
                      </button>

                      <button
                        className="held-cancel-btn"
                        onClick={()=>cancelHeld(h.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}

                </div>
              )}

            </section>

            <section>

              <small>
                DEVICE
              </small>

              <button onClick={syncMenu}>
                ↻ Sync Menu
              </button>

              <button
                onClick={manualDrawer}
              >
                ▣ Open Cash Drawer
              </button>

              <button
                onClick={()=>
                  location.href='/customer-display'
                }
              >
                ▣ Customer Display
              </button>

            </section>

            <section className="drawer-bottom-actions">

              <button
                className="logout-drawer"
                onClick={logout}
              >
                Log Out
              </button>

            </section>

          </aside>

        </div>
      )}

      {sizePicker&&(
        <div
          className="size-picker-backdrop"
          onClick={()=>
            setSizePicker(null)
          }
        >

          <div
            className="size-picker"
            onClick={e=>
              e.stopPropagation()
            }
          >

            <div className="size-picker-head">

              <div>
                <small>
                  SELECT SIZE
                </small>

                <strong>
                  {sizePicker.name}
                </strong>
              </div>

              <button
                onClick={()=>
                  setSizePicker(null)
                }
              >
                ×
              </button>

            </div>

            <div className="size-options">

              {sizePicker.sizes?.map(s=>(
                <button
                  key={s.id}
                  onClick={()=>
                    chooseSize(
                      sizePicker,
                      s
                    )
                  }
                >
                  <span>
                    {s.name}
                  </span>

                  <b>
                    {money(
                      sizePicker.price+
                      s.price_delta
                    )}
                  </b>
                </button>
              ))}

            </div>

          </div>

        </div>
      )}

      {shiftOpenModal&&(
        <div className="pos-big-modal-backdrop">
          <div className="pos-big-modal">
            <div className="pos-big-modal-head">
              <div>
                <small>SHIFT CONTROL</small>
                <h2>Open Shift</h2>
              </div>
              <button onClick={()=>setShiftOpenModal(false)}>×</button>
            </div>

            <label className="pos-big-field">
              <span>Starting Cash</span>
              <div className="pos-big-money-input">
                <b>AED</b>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={openingCashInput}
                  onChange={e=>setOpeningCashInput(e.target.value)}
                />
              </div>
            </label>

            <button className="pos-big-primary" onClick={confirmOpenShift}>
              OPEN SHIFT
            </button>
          </div>
        </div>
      )}

      {shiftCloseModal&&shift&&(
        <div className="pos-big-modal-backdrop">
          <div className="pos-big-modal">
            <div className="pos-big-modal-head">
              <div>
                <small>SHIFT CONTROL</small>
                <h2>Close Shift</h2>
              </div>
              <button onClick={()=>setShiftCloseModal(false)}>×</button>
            </div>

            <div className="pos-expected-cash">
              <span>Expected Cash</span>
              <strong>{money(shift.expected_cash)}</strong>
            </div>

            <label className="pos-big-field">
              <span>Actual Cash in Drawer</span>
              <div className="pos-big-money-input">
                <b>AED</b>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={actualCashInput}
                  onChange={e=>setActualCashInput(e.target.value)}
                />
              </div>
            </label>

            <label className="pos-big-field">
              <span>Admin / Manager PIN</span>
              <input
                className="pos-big-pin"
                type="password"
                inputMode="numeric"
                value={managerPinInput}
                onChange={e=>setManagerPinInput(e.target.value)}
              />
            </label>

            <button className="pos-big-primary pos-big-danger" onClick={confirmCloseShift}>
              CLOSE SHIFT
            </button>
          </div>
        </div>
      )}

      {closingReport&&(
        <div className="closing-modal-backdrop">

          <div className="closing-receipt closing-receipt-short">

            <div className="closing-receipt-head">

              <div>

                <b>
                  {settings?.shop_name||'MAHI POS'}
                </b>

                <span>
                  SHIFT CLOSING · #{closingReport.id}
                </span>

              </div>

              <button
                onClick={()=>
                  setClosingReport(null)
                }
              >
                ×
              </button>

            </div>

            <div className="closing-meta">

              <span>
                {new Date(
                  closingReport.closed_at
                ).toLocaleDateString('en-GB')}
              </span>

              <span>
                Cashier: <b>{closingReport.staff_name}</b>
              </span>

            </div>

            <div className="closing-lines">

              <div>
                <span>
                  Opening Cash
                </span>

                <b>
                  {money(closingReport.starting_cash)}
                </b>
              </div>

              <div>
                <span>
                  Cash Sales
                </span>

                <b>
                  {money(closingReport.cash_sales)}
                </b>
              </div>

              <div>
                <span>
                  Card Sales
                </span>

                <b>
                  {money(closingReport.card_sales)}
                </b>
              </div>

              <div>
                <span>
                  Refund
                </span>

                <b>
                  - {money(closingReport.refunds)}
                </b>
              </div>

              <div>
                <span>
                  Cash In
                </span>

                <b>
                  + {money(closingReport.cash_in)}
                </b>
              </div>

              <div>
                <span>
                  Cash Out
                </span>

                <b>
                  - {money(closingReport.cash_out)}
                </b>
              </div>

              <div>
                <span>
                  Expenses
                </span>

                <b>
                  - {money(closingReport.expenses)}
                </b>
              </div>

              <hr/>

              <div className="strong">

                <span>
                  NET SALES
                </span>

                <b>
                  {money(
                    Number(
                      closingReport.gross_sales||0
                    )-
                    Number(
                      closingReport.refunds||0
                    )
                  )}
                </b>

              </div>

              <hr/>

              <div>
                <span>
                  Expected Cash
                </span>

                <b>
                  {money(closingReport.expected_cash)}
                </b>
              </div>

              <div>
                <span>
                  Actual Cash
                </span>

                <b>
                  {money(closingReport.actual_cash)}
                </b>
              </div>

              <div
                className={`strong ${
                  Number(closingReport.difference)!==0
                    ?'difference'
                    :''
                }`}
              >
                <span>
                  DIFFERENCE
                </span>

                <b>
                  {money(closingReport.difference)}
                </b>
              </div>

            </div>

            <div className="closing-footer closing-footer-short">

              <div>

                <span>
                  Orders: <b>{closingReport.order_count}</b>
                </span>

                <span>
                  Closed By: <b>{closingReport.closed_by}</b>
                </span>

              </div>

              <strong>
                SHIFT CLOSED
              </strong>

              <button
                className="primary-btn"
                onClick={()=>
                  setClosingReport(null)
                }
              >
                DONE
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}
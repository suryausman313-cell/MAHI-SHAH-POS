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
  const [held,setHeld]=useState<any[]>([])
  const [cart,setCart]=useState<Record<number,number>>({})
  const [mods,setMods]=useState<Record<number,number[]>>({})
  const [category,setCategory]=useState('')
  const [search,setSearch]=useState('')
  const [barcode,setBarcode]=useState('')
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
  const [sizePicker,setSizePicker]=useState<MenuItem|null>(null)
  const [selectedSizes,setSelectedSizes]=useState<Record<number,{id:number;name:string;price_delta:number}>>({})

  const load=async()=>{
    const [m,t,s,c,st,sh,h]=await Promise.all([
      api<MenuItem[]>('/menu'),
      api<PosTable[]>('/tables'),
      api<Staff[]>('/staff'),
      api<Customer[]>('/customers'),
      api<Settings>('/settings'),
      api<Shift|null>('/shifts/current'),
      api<any[]>('/orders/held/list')
    ])

    setMenu(m)
    setTables(t)
    setStaff(s)
    setCustomers(c)
    setSettings(st)
    setShift(sh)
    setHeld(h)

    if(isWaiter&&loggedUser?.id){
      setWaiterId(loggedUser.id)
    }
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

  const scan=async()=>{
    if(!barcode.trim())return

    try{
      const item:any=await api(
        '/menu/barcode/'+
        encodeURIComponent(barcode.trim())
      )

      if(item.sizes?.length){
        setSizePicker(item)
      }else{
        qty(item.id,1)
      }

      setBarcode('')
    }catch(e:any){
      alert(e.message)
    }
  }

  const openShift=async()=>{
    const opening=prompt(
      'Opening cash AED',
      '0'
    )

    if(opening===null)return

    try{
      const s:any=await api(
        '/shifts/open',
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            opening_cash:+opening||0,
            staff_id:loggedUser?.id||null
          })
        }
      )

      await load()
      alert('Shift opened #'+s.id)

    }catch(e:any){
      alert(e.message)
    }
  }

  const closeShift=async()=>{
    if(!shift)return

    const actual=prompt(
      `Expected cash AED ${shift.expected_cash}\nEnter actual cash in drawer:`
    )

    if(actual===null)return

    const pin=prompt(
      'Manager/Admin PIN'
    )

    if(!pin)return

    try{
      const r:any=await api(
        `/shifts/${shift.id}/close`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            actual_cash:+actual||0,
            staff_pin:pin
          })
        }
      )

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

      alert(
        kind==='in'
          ?'Cash In saved'
          :'Cash Out saved'
      )

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

      alert('Expense saved')

    }catch(e:any){
      alert(e.message)
    }
  }

  const manualDrawer=async()=>{
    if(!settings)return

    try{
      await openCashDrawer(settings)
      alert('Cash drawer opened')

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

      if(
        !hold &&
        settings?.auto_print &&
        settings?.printer_ip
      ){
        try{
          const full:any=await api(
            '/orders/'+created.id
          )

          await sendToIpPrinter(
            full,
            settings
          )

        }catch(e:any){
          alert(
            `Order saved but print failed: ${e.message}`
          )
        }
      }

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

      alert(
        hold
          ?`Order #${created.id} held`
          :`Order #${created.id} saved`
      )

      await load()

    }catch(e:any){
      alert(e.message)

    }finally{
      setSaving(false)
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

      alert(
        `Order #${id} recalled`
      )

    }catch(e:any){
      alert(e.message)
    }
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

          {!cashierCompact&&(
            <div className="barcode-box">

              <input
                placeholder="Barcode"
                value={barcode}
                onChange={e=>
                  setBarcode(e.target.value)
                }
                onKeyDown={e=>
                  e.key==='Enter'&&scan()
                }
              />

              <button onClick={scan}>
                Scan
              </button>

            </div>
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
              onChange={e=>
                setSearch(e.target.value)
              }
            />

            <div className="barcode-box">

              <input
                placeholder="Barcode"
                value={barcode}
                onChange={e=>
                  setBarcode(e.target.value)
                }
                onKeyDown={e=>
                  e.key==='Enter'&&scan()
                }
              />

              <button onClick={scan}>
                Scan
              </button>

            </div>

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
              {type}
            </strong>
          </div>

          <button
            className="ghost-danger"
            onClick={()=>{
              setCart({})
              setMods({})
              setSelectedSizes({})
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

          {settings?.allow_discounts!==false&&(
            <label>

              <span>
                Discount
              </span>

              <div className="money-input">

                <span>
                  AED
                </span>

                <input
                  type="number"
                  value={discount}
                  onChange={e=>
                    setDiscount(
                      +e.target.value||0
                    )
                  }
                />

              </div>

            </label>
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
                onClick={()=>
                  submit(false)
                }
                disabled={saving}
              >
                {saving
                  ?'Saving...'
                  :`SAVE ORDER · ${money(total)}`}
              </button>

              {settings?.allow_hold_orders!==false&&(
                <button
                  className="secondary-button"
                  onClick={()=>
                    submit(true)
                  }
                >
                  HOLD ORDER
                </button>
              )}

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
                ⌕ Search / Barcode
              </button>

              {held.length>0&&(
                <div className="drawer-held">

                  <b>
                    Held Orders ({held.length})
                  </b>

                  {held.slice(0,8).map(h=>(
                    <button
                      key={h.id}
                      onClick={()=>{
                        recall(h.id)
                        setCashierMenuOpen(false)
                      }}
                    >
                      Recall #{h.id} · {money(h.total)}
                    </button>
                  ))}

                </div>
              )}

            </section>

            <section>

              <small>
                DEVICE
              </small>

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

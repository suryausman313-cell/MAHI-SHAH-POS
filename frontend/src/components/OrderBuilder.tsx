import React, {useEffect, useMemo, useState} from 'react'
import {api, money, sendToIpPrinter, openCashDrawer} from '../api'
import type {MenuItem, PosTable, Staff, Settings} from '../types'

type Customer = {
  id: number
  name: string
  phone: string
  address: string
  points: number
}

type Shift = {
  id: number
  opening_cash: number
  expected_cash: number
  cash_sales: number
  card_sales: number
}

export default function OrderBuilder({
  waiterMode = false,
  cashierCompact = false,
}: {
  waiterMode?: boolean
  cashierCompact?: boolean
}) {
  const loggedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('mahi_user') || 'null')
    } catch {
      return null
    }
  })()

  const isCashier =
    loggedUser?.role === 'cashier' ||
    loggedUser?.role === 'admin' ||
    loggedUser?.role === 'manager'

  const isWaiter = loggedUser?.role === 'waiter' || waiterMode

  const [menu, setMenu] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<PosTable[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [shift, setShift] = useState<Shift | null>(null)
  const [held, setHeld] = useState<any[]>([])

  const [cart, setCart] = useState<Record<number, number>>({})
  const [mods, setMods] = useState<Record<number, number[]>>({})

  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [barcode, setBarcode] = useState('')

  const [type, setType] = useState('takeaway')
  const [pay, setPay] = useState('cash')

  const [discount, setDiscount] = useState(0)
  const [cashPaid, setCashPaid] = useState(0)
  const [cardPaid, setCardPaid] = useState(0)

  const [waiterId, setWaiterId] = useState<number | undefined>()
  const [customerId, setCustomerId] = useState<number | undefined>()
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const [saving, setSaving] = useState(false)
  const [cashierMenuOpen, setCashierMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  const load = async () => {
    const [m, t, s, c, st, sh, h] = await Promise.all([
      api<MenuItem[]>('/menu'),
      api<PosTable[]>('/tables'),
      api<Staff[]>('/staff'),
      api<Customer[]>('/customers'),
      api<Settings>('/settings'),
      api<Shift | null>('/shifts/current'),
      api<any[]>('/orders/held/list'),
    ])

    setMenu(m)
    setTables(t)
    setStaff(s)
    setCustomers(c)
    setSettings(st)
    setShift(sh)
    setHeld(h)

    if (isWaiter && loggedUser?.id) {
      setWaiterId(loggedUser.id)
    }
  }

  useEffect(() => {
    load().catch(console.error)
  }, [])

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(menu.map(x => x.category)))],
    [menu]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()

    return menu.filter(
      item =>
        (category === 'All' || item.category === category) &&
        (!q ||
          item.name.toLowerCase().includes(q) ||
          item.barcode === q)
    )
  }, [menu, category, search])

  const cartLines = useMemo(
    () => menu.filter(item => (cart[item.id] || 0) > 0),
    [menu, cart]
  )

  const subtotal = useMemo(() => {
    return cartLines.reduce((sum, item) => {
      const modifierTotal = (mods[item.id] || [])
        .map(
          id =>
            item.modifiers?.find(modifier => modifier.id === id)?.price || 0
        )
        .reduce((a, b) => a + b, 0)

      return (
        sum +
        (cart[item.id] || 0) *
          (item.price + modifierTotal)
      )
    }, 0)
  }, [cartLines, cart, mods])

  const grossAfterDiscount = Math.max(0, subtotal - discount)

  const vatRate =
    settings?.vat_enabled === false
      ? 0
      : Number(settings?.vat_percent ?? 5)

  const vatInclusive = settings?.vat_inclusive !== false

  const vat =
    vatRate > 0
      ? vatInclusive
        ? grossAfterDiscount -
          grossAfterDiscount / (1 + vatRate / 100)
        : grossAfterDiscount * (vatRate / 100)
      : 0

  const taxable = vatInclusive
    ? grossAfterDiscount - vat
    : grossAfterDiscount

  const total = vatInclusive
    ? grossAfterDiscount
    : taxable + vat

  const qty = (id: number, change: number) => {
    setCart(current => ({
      ...current,
      [id]: Math.max(0, (current[id] || 0) + change),
    }))
  }

  const toggleMod = (itemId: number, modId: number) => {
    setMods(current => {
      const selected = current[itemId] || []

      return {
        ...current,
        [itemId]: selected.includes(modId)
          ? selected.filter(id => id !== modId)
          : [...selected, modId],
      }
    })
  }

  const scan = async () => {
    if (!barcode.trim()) return

    try {
      const item: any = await api(
        '/menu/barcode/' + encodeURIComponent(barcode.trim())
      )

      qty(item.id, 1)
      setBarcode('')
    } catch (e: any) {
      alert(e.message)
    }
  }

  const openShift = async () => {
    const opening = prompt('Opening cash AED', '0')

    if (opening === null) return

    const result: any = await api('/shifts/open', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        opening_cash: +opening || 0,
      }),
    })

    await load()
    alert('Shift opened #' + result.id)
  }

  const closeShift = async () => {
    if (!shift) return

    const actual = prompt(
      `Expected cash AED ${shift.expected_cash}\nEnter actual cash:`
    )

    if (actual === null) return

    const pin = prompt('Manager/Admin PIN')

    if (!pin) return

    try {
      const result: any = await api(
        `/shifts/${shift.id}/close`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            actual_cash: +actual || 0,
            staff_pin: pin,
          }),
        }
      )

      alert(
        `Shift closed. Difference AED ${result.difference}`
      )

      await load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const cashMove = async (kind: 'in' | 'out') => {
    if (!shift) {
      alert('Open shift first')
      return
    }

    const amount = prompt(
      kind === 'in'
        ? 'Cash In amount AED'
        : 'Cash Out amount AED'
    )

    if (!amount) return

    const reason = prompt('Reason') || ''

    try {
      await api(`/shifts/${shift.id}/cash`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          movement_type: kind,
          amount: +amount || 0,
          reason,
        }),
      })

      await load()

      alert(
        kind === 'in'
          ? 'Cash In saved'
          : 'Cash Out saved'
      )
    } catch (e: any) {
      alert(e.message)
    }
  }

  const addExpenseQuick = async () => {
    const title = prompt('Expense name')

    if (!title) return

    const amount = prompt('Expense amount AED')

    if (!amount) return

    const category =
      prompt('Category', 'General') || 'General'

    try {
      await api('/expenses', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title,
          amount: +amount || 0,
          category,
        }),
      })

      alert('Expense saved')
    } catch (e: any) {
      alert(e.message)
    }
  }

  const manualDrawer = async () => {
    if (!settings) return

    try {
      await openCashDrawer(settings)
      alert('Cash drawer opened')
    } catch (e: any) {
      alert(e.message)
    }
  }

  const logout = () => {
    localStorage.removeItem('mahi_user')
    location.href = '/login'
  }

  const addCustomer = async () => {
    const name = prompt('Customer name')

    if (!name) return

    const phone = prompt('Phone') || ''
    const address = prompt('Address') || ''

    const result: any = await api('/customers', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name,
        phone,
        address,
      }),
    })

    await load()
    setCustomerId(result.id)
  }

  const submit = async (hold = false) => {
    const items = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({
        menu_item_id: +id,
        qty: quantity,
        modifier_ids: mods[+id] || [],
      }))

    if (!items.length) {
      alert('Add items first')
      return
    }

    if (
      isCashier &&
      settings?.require_shift &&
      !shift
    ) {
      alert('Open shift first')
      return
    }

    if (
      type === 'delivery' &&
      !deliveryAddress.trim()
    ) {
      alert('Enter delivery address')
      return
    }

    if (
      pay === 'split' &&
      Math.abs(cashPaid + cardPaid - total) > 0.01
    ) {
      alert('Cash + Card must equal total')
      return
    }

    setSaving(true)

    try {
      const created: any = await api('/orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          items,
          order_type: type,
          payment_method: pay,

          cash_paid:
            pay === 'split' ? cashPaid : null,

          card_paid:
            pay === 'split' ? cardPaid : null,

          table_id: null,

          waiter_id:
            waiterId || null,

          customer_id:
            type === 'delivery'
              ? customerId || null
              : null,

          shift_id:
            shift?.id || null,

          discount,

          coupon_code: null,

          delivery_address:
            type === 'delivery'
              ? deliveryAddress
              : '',

          hold,
        }),
      })

      setCart({})
      setMods({})
      setDiscount(0)
      setCashPaid(0)
      setCardPaid(0)
      setDeliveryAddress('')

      if (
        !hold &&
        settings?.auto_print &&
        settings?.printer_ip
      ) {
        try {
          const fullOrder: any = await api(
            '/orders/' + created.id
          )

          await sendToIpPrinter(
            fullOrder,
            settings
          )
        } catch (e: any) {
          alert(
            `Order saved but print failed: ${e.message}`
          )
        }
      }

      if (
        !hold &&
        pay === 'cash' &&
        settings?.auto_cash_drawer !== false
      ) {
        try {
          await openCashDrawer(settings)
        } catch (e: any) {
          console.warn(
            'Cash drawer:',
            e.message
          )
        }
      }

      alert(
        hold
          ? `Order #${created.id} held`
          : `Order #${created.id} saved`
      )

      await load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const recall = async (id: number) => {
    await api(`/orders/${id}/recall`, {
      method: 'POST',
    })

    await load()

    alert(`Order #${id} recalled`)
  }

  if (settings?.app_enabled === false) {
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

  if (settings?.shop_open === false) {
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
          ? 'cashier-clean-workspace'
          : ''
      } card-${
        settings?.cashier_card_size || 'auto'
      }`}
    >
      <div className="product-area">

        {cashierCompact && isCashier && (
          <div className="cashier-clean-head">

            <button
              className="hamburger-btn"
              onClick={() =>
                setCashierMenuOpen(true)
              }
            >
              ☰
            </button>

            <div
              className={`cashier-shift-mini ${
                shift ? 'open' : 'closed'
              }`}
            >
              <i />

              <span>
                {shift
                  ? `Shift #${shift.id} Open`
                  : 'Shift Closed'}
              </span>
            </div>

            <div className="cashier-clock">
              {new Date().toLocaleDateString(
                'en-GB'
              )}
            </div>
          </div>
        )}

        {isCashier &&
          !cashierCompact && (
            <div className="shift-strip">

              <div>
                {shift ? (
                  <>
                    <b>
                      Shift #{shift.id} OPEN
                    </b>

                    <span>
                      Expected cash{' '}
                      {money(
                        shift.expected_cash
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <b>No open shift</b>
                    <span>
                      Open shift before sales
                    </span>
                  </>
                )}
              </div>

              {shift ? (
                <button
                  onClick={closeShift}
                >
                  Close Shift
                </button>
              ) : (
                <button
                  onClick={openShift}
                >
                  Open Shift
                </button>
              )}
            </div>
          )}

        <div className="pos-toolbar">

          <div className="segment">

            <button
              className={
                type === 'takeaway'
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                setType('takeaway')
              }
            >
              Takeaway
            </button>

            {settings?.allow_delivery !==
              false && (
              <button
                className={
                  type === 'delivery'
                    ? 'selected'
                    : ''
                }
                onClick={() =>
                  setType('delivery')
                }
              >
                Delivery
              </button>
            )}
          </div>

          {!cashierCompact && (
            <input
              className="search-box"
              placeholder="Search products..."
              value={search}
              onChange={e =>
                setSearch(e.target.value)
              }
            />
          )}

          {!cashierCompact && (
            <div className="barcode-box">
              <input
                placeholder="Barcode"
                value={barcode}
                onChange={e =>
                  setBarcode(e.target.value)
                }
                onKeyDown={e =>
                  e.key === 'Enter' && scan()
                }
              />

              <button onClick={scan}>
                Scan
              </button>
            </div>
          )}

          {isWaiter ? (
            <div className="staff-fixed-pill">
              Waiter:{' '}
              {loggedUser?.name ||
                'Current staff'}
            </div>
          ) : (
            !cashierCompact && (
              <select
                value={waiterId || ''}
                onChange={e =>
                  setWaiterId(
                    +e.target.value ||
                      undefined
                  )
                }
              >
                <option value="">
                  No waiter
                </option>

                {staff
                  .filter(
                    s => s.role === 'waiter'
                  )
                  .map(s => (
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

          {cashierCompact && (
            <button
              className="cashier-tool-btn"
              onClick={() =>
                setToolsOpen(!toolsOpen)
              }
            >
              ⌕
            </button>
          )}
        </div>

        {cashierCompact &&
          toolsOpen && (
            <div className="cashier-tools-panel">

              <input
                className="search-box"
                placeholder="Search menu..."
                value={search}
                onChange={e =>
                  setSearch(e.target.value)
                }
              />

              <div className="barcode-box">
                <input
                  placeholder="Barcode"
                  value={barcode}
                  onChange={e =>
                    setBarcode(e.target.value)
                  }
                  onKeyDown={e =>
                    e.key === 'Enter' &&
                    scan()
                  }
                />

                <button onClick={scan}>
                  Scan
                </button>
              </div>
            </div>
          )}

        <div className="category-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={
                category === cat
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setCategory(cat)
              }
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="product-grid">
          {filtered.map(item => (
            <div
              className="product-card-wrap"
              key={item.id}
            >
              <button
                className="product-card"
                onClick={() =>
                  qty(item.id, 1)
                }
              >
                <div className="product-photo">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                    />
                  ) : (
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
                    {money(item.price)}
                  </b>
                </div>

                {(cart[item.id] || 0) >
                  0 && (
                  <em>
                    {cart[item.id]}
                  </em>
                )}
              </button>

              {(cart[item.id] || 0) >
                0 &&
              item.modifiers?.length ? (
                <div className="modifier-mini">
                  {item.modifiers.map(
                    modifier => (
                      <label
                        key={modifier.id}
                      >
                        <input
                          type="checkbox"
                          checked={(
                            mods[item.id] ||
                            []
                          ).includes(
                            modifier.id
                          )}
                          onChange={() =>
                            toggleMod(
                              item.id,
                              modifier.id
                            )
                          }
                        />

                        {modifier.name} +
                        {modifier.price}
                      </label>
                    )
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <aside className="order-panel">

        <div className="order-panel-head">

          <div>
            <span>Current order</span>
            <strong>{type}</strong>
          </div>

          <button
            className="ghost-danger"
            onClick={() => {
              setCart({})
              setMods({})
            }}
          >
            Clear
          </button>
        </div>

        <div className="cart-lines">

          {!cartLines.length && (
            <div className="empty-cart">
              <div>🧾</div>
              <strong>No items yet</strong>
              <span>
                Tap a product to add it
              </span>
            </div>
          )}

          {cartLines.map(item => (
            <div
              className="cart-line"
              key={item.id}
            >
              <div className="cart-main">

                <strong>
                  {item.name}
                </strong>

                <small>
                  {money(item.price)} each
                </small>
              </div>

              <div className="qty-stepper">

                <button
                  onClick={() =>
                    qty(item.id, -1)
                  }
                >
                  −
                </button>

                <b>{cart[item.id]}</b>

                <button
                  onClick={() =>
                    qty(item.id, 1)
                  }
                >
                  +
                </button>
              </div>

              <strong>
                {money(
                  (cart[item.id] || 0) *
                    item.price
                )}
              </strong>
            </div>
          ))}
        </div>

        <div className="order-summary">

          {type === 'delivery' && (
            <>
              <div className="customer-line">

                <select
                  value={customerId || ''}
                  onChange={e =>
                    setCustomerId(
                      +e.target.value ||
                        undefined
                    )
                  }
                >
                  <option value="">
                    No customer
                  </option>

                  {customers.map(customer => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.name}
                      {customer.phone
                        ? ` · ${customer.phone}`
                        : ''}
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
                onChange={e =>
                  setDeliveryAddress(
                    e.target.value
                  )
                }
              />
            </>
          )}

          {settings?.allow_discounts !==
            false && (
            <label>
              <span>Discount</span>

              <div className="money-input">
                <span>AED</span>

                <input
                  type="number"
                  value={discount}
                  onChange={e =>
                    setDiscount(
                      +e.target.value || 0
                    )
                  }
                />
              </div>
            </label>
          )}

          <div className="summary-row">
            <span>Subtotal</span>
            <b>{money(subtotal)}</b>
          </div>

          {settings?.vat_enabled !==
            false &&
            settings?.vat_inclusive !==
              false && (
              <div className="summary-row vat-included-line">
                <span>VAT Included</span>
                <b />
              </div>
            )}

          {settings?.vat_enabled !==
            false &&
            settings?.vat_inclusive ===
              false && (
              <div className="summary-row">
                <span>
                  VAT {vatRate}%
                </span>

                <b>{money(vat)}</b>
              </div>
            )}

          <div className="summary-row total">
            <span>Total</span>
            <b>{money(total)}</b>
          </div>

          {isCashier && (
            <>
              <div className="payment-switch">

                {[
                  'cash',
                  'card',
                  ...(settings?.allow_split_payment ===
                  false
                    ? []
                    : ['split']),
                ].map(payment => (
                  <button
                    key={payment}
                    className={
                      pay === payment
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setPay(payment)
                    }
                  >
                    {payment}
                  </button>
                ))}
              </div>

              {pay === 'split' && (
                <div className="split-pay">

                  <input
                    type="number"
                    placeholder="Cash"
                    value={cashPaid || ''}
                    onChange={e =>
                      setCashPaid(
                        +e.target.value ||
                          0
                      )
                    }
                  />

                  <input
                    type="number"
                    placeholder="Card"
                    value={cardPaid || ''}
                    onChange={e =>
                      setCardPaid(
                        +e.target.value ||
                          0
                      )
                    }
                  />
                </div>
              )}

              <button
                className="pay-button"
                onClick={() =>
                  submit(false)
                }
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : `SAVE ORDER · ${money(
                      total
                    )}`}
              </button>

              {settings?.allow_hold_orders !==
                false && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    submit(true)
                  }
                >
                  HOLD ORDER
                </button>
              )}
            </>
          )}

          {isWaiter && (
            <>
              <button
                className="pay-button waiter-send"
                onClick={() =>
                  submit(false)
                }
                disabled={saving}
              >
                {saving
                  ? 'Sending...'
                  : 'SEND ORDER'}
              </button>
            </>
          )}
        </div>
      </aside>

      {cashierCompact &&
        cashierMenuOpen && (
          <div
            className="cashier-drawer-backdrop"
            onClick={() =>
              setCashierMenuOpen(false)
            }
          >
            <aside
              className="cashier-drawer-menu"
              onClick={e =>
                e.stopPropagation()
              }
            >

              <div className="cashier-drawer-title">

                <div>
                  <strong>
                    Cashier Menu
                  </strong>

                  <span>
                    {loggedUser?.name ||
                      'Cashier'}
                  </span>
                </div>

                <button
                  onClick={() =>
                    setCashierMenuOpen(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <section>
                <small>SHIFT & CASH</small>

                {!shift ? (
                  <button
                    onClick={() => {
                      setCashierMenuOpen(
                        false
                      )
                      openShift()
                    }}
                  >
                    ◷ Open Shift
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setCashierMenuOpen(
                          false
                        )
                        closeShift()
                      }}
                    >
                      ◷ Close Shift
                    </button>

                    <button
                      onClick={() =>
                        cashMove('in')
                      }
                    >
                      ＋ Cash In
                    </button>

                    <button
                      onClick={() =>
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
                <small>ORDERS</small>

                <button
                  onClick={() => {
                    setCashierMenuOpen(
                      false
                    )
                    setToolsOpen(true)
                  }}
                >
                  ⌕ Search / Barcode
                </button>

                {held.length > 0 && (
                  <div className="drawer-held">

                    <b>
                      Held Orders (
                      {held.length})
                    </b>

                    {held
                      .slice(0, 8)
                      .map(order => (
                        <button
                          key={order.id}
                          onClick={() => {
                            recall(order.id)
                            setCashierMenuOpen(
                              false
                            )
                          }}
                        >
                          Recall #{order.id} ·{' '}
                          {money(
                            order.total
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </section>

              <section>
                <small>DEVICE</small>

                <button
                  onClick={manualDrawer}
                >
                  ▣ Open Cash Drawer
                </button>

                <button
                  onClick={() =>
                    (location.href =
                      '/customer-display')
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
    </div>
  )
}

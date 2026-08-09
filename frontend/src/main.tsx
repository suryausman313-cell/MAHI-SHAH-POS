import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API =
  (import.meta as any).env.VITE_API_URL ||
  'http://localhost:8000'

type Item = {
  id: number
  name: string
  category: string
  price: number
  active: boolean
}

type Order = {
  id: number
  status: string
  order_type: string
  payment_method: string
  total: number
  items: {
    name: string
    qty: number
  }[]
}

function Nav() {
  return (
    <div className="nav">
      <b>Restaurant POS</b>
      <a href="/">Cashier</a>
      <a href="/kitchen">Kitchen</a>
      <a href="/admin">Admin</a>
    </div>
  )
}

function Cashier() {
  const [menu, setMenu] = useState<Item[]>([])
  const [cart, setCart] = useState<Record<number, number>>({})
  const [pay, setPay] = useState('cash')
  const [type, setType] = useState('takeaway')

  useEffect(() => {
    fetch(API + '/menu')
      .then(r => r.json())
      .then(setMenu)
  }, [])

  const total = useMemo(() => {
    return menu.reduce((sum, item) => {
      return sum + (cart[item.id] || 0) * item.price
    }, 0)
  }, [menu, cart])

  const add = (id: number) => {
    setCart(current => ({
      ...current,
      [id]: (current[id] || 0) + 1
    }))
  }

  const submit = async () => {
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        menu_item_id: +id,
        qty
      }))

    if (!items.length) {
      alert('Add items first')
      return
    }

    const response = await fetch(API + '/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items,
        order_type: type,
        payment_method: pay
      })
    })

    const data = await response.json()

    alert(`Order #${data.id} created. Total AED ${data.total}`)

    setCart({})
  }

  return (
    <>
      <Nav />

      <main>
        <h1>Cashier POS</h1>

        <div className="toolbar">
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="takeaway">Takeaway</option>
            <option value="dinein">Dine In</option>
            <option value="delivery">Delivery</option>
          </select>

          <select value={pay} onChange={e => setPay(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </div>

        <div className="grid">
          {menu.map(item => (
            <button
              className="item"
              key={item.id}
              onClick={() => add(item.id)}
            >
              <b>{item.name}</b>
              <span>{item.category}</span>
              <strong>AED {item.price.toFixed(2)}</strong>

              {cart[item.id] ? (
                <em>Qty {cart[item.id]}</em>
              ) : null}
            </button>
          ))}
        </div>

        <div className="checkout">
          <div>Subtotal AED {total.toFixed(2)}</div>
          <div>VAT 5% AED {(total * 0.05).toFixed(2)}</div>
          <b>Total AED {(total * 1.05).toFixed(2)}</b>

          <button onClick={submit}>
            PLACE ORDER
          </button>
        </div>
      </main>
    </>
  )
}

function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([])

  const load = () => {
    fetch(API + '/orders')
      .then(r => r.json())
      .then((data: Order[]) => {
        setOrders(
          data.filter(
            order =>
              !['completed', 'cancelled'].includes(order.status)
          )
        )
      })
  }

  useEffect(() => {
    load()

    const timer = setInterval(load, 3000)

    return () => clearInterval(timer)
  }, [])

  const changeStatus = async (id: number, status: string) => {
    await fetch(
      `${API}/orders/${id}/status/${status}`,
      {
        method: 'PATCH'
      }
    )

    load()
  }

  return (
    <>
      <Nav />

      <main>
        <h1>Kitchen KDS</h1>

        <div className="orders">
          {orders.map(order => (
            <div className="order" key={order.id}>
              <h2>
                #{order.id}{' '}
                <small>{order.status.toUpperCase()}</small>
              </h2>

              {order.items.map((item, index) => (
                <p key={index}>
                  {item.qty} × {item.name}
                </p>
              ))}

              <div className="actions">
                {order.status === 'new' && (
                  <button
                    onClick={() =>
                      changeStatus(order.id, 'preparing')
                    }
                  >
                    Start Preparing
                  </button>
                )}

                {order.status === 'preparing' && (
                  <button
                    onClick={() =>
                      changeStatus(order.id, 'ready')
                    }
                  >
                    Ready
                  </button>
                )}

                {order.status === 'ready' && (
                  <button
                    onClick={() =>
                      changeStatus(order.id, 'completed')
                    }
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}

function Admin() {
  const [items, setItems] = useState<Item[]>([])
  const [report, setReport] = useState<any>({})
  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [price, setPrice] = useState('')

  const load = () => {
    fetch(API + '/admin/menu')
      .then(r => r.json())
      .then(setItems)

    fetch(API + '/reports/today')
      .then(r => r.json())
      .then(setReport)
  }

  useEffect(load, [])

  const addItem = async () => {
    if (!name || !price) return

    await fetch(API + '/admin/menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        category,
        price: +price,
        active: true
      })
    })

    setName('')
    setPrice('')
    load()
  }

  const deleteItem = async (id: number) => {
    await fetch(API + '/admin/menu/' + id, {
      method: 'DELETE'
    })

    load()
  }

  return (
    <>
      <Nav />

      <main>
        <h1>Admin</h1>

        <div className="stats">
          <div>
            <b>{report.orders || 0}</b>
            <span>Orders</span>
          </div>

          <div>
            <b>AED {report.sales || 0}</b>
            <span>Sales</span>
          </div>

          <div>
            <b>AED {report.cash || 0}</b>
            <span>Cash</span>
          </div>

          <div>
            <b>AED {report.card || 0}</b>
            <span>Card</span>
          </div>
        </div>

        <section>
          <h2>Add Menu Item</h2>

          <div className="form">
            <input
              placeholder="Item name"
              value={name}
              onChange={e => setName(e.target.value)}
            />

            <input
              placeholder="Category"
              value={category}
              onChange={e => setCategory(e.target.value)}
            />

            <input
              placeholder="Price"
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />

            <button onClick={addItem}>
              Add
            </button>
          </div>
        </section>

        <section>
          <h2>Menu</h2>

          {items.map(item => (
            <div className="row" key={item.id}>
              <span>
                {item.name} — {item.category}
              </span>

              <b>AED {item.price.toFixed(2)}</b>

              <button onClick={() => deleteItem(item.id)}>
                Delete
              </button>
            </div>
          ))}
        </section>
      </main>
    </>
  )
}

function App() {
  const path = location.pathname

  if (path.startsWith('/kitchen')) {
    return <Kitchen />
  }

  if (path.startsWith('/admin')) {
    return <Admin />
  }

  return <Cashier />
}

createRoot(
  document.getElementById('root')!
).render(<App />)

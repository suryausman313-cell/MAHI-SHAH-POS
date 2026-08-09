import React, {useEffect, useMemo, useState} from 'react'
import Shell from '../components/Shell'
import {api, orderTime} from '../api'
import type {Order} from '../types'

const columns = [
  {key:'new',title:'New Orders',action:'Start',next:'preparing'},
  {key:'preparing',title:'Preparing',action:'Ready',next:'ready'},
  {key:'ready',title:'Ready',action:'Complete',next:'completed'},
]

export default function Kitchen(){
  const [orders,setOrders] = useState<Order[]>([])
  const [filter,setFilter] = useState('all')
  const [lastCount,setLastCount]=useState(0)
  const [settings,setSettings]=useState<any>({})

  const load = async()=>{
    const data = await api<Order[]>('/orders')
    const active=data.filter(x=>!['completed','cancelled','refunded','held'].includes(x.status))
    if(active.filter(x=>x.status==='new').length>lastCount){
      try{const a=new AudioContext();const o=a.createOscillator();const g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=.15;o.start();o.stop(a.currentTime+.35)}catch{}
    }
    setLastCount(active.filter(x=>x.status==='new').length)
    setOrders(active)
  }

  useEffect(()=>{
    load().catch(console.error)
    const t=setInterval(()=>load().catch(console.error),3000)
    return()=>clearInterval(t)
  },[])

  const change = async(id:number,status:string)=>{
    await api(`/orders/${id}/status/${status}`,{method:'PATCH'})
    await load()
  }

  const filtered = useMemo(
    ()=>filter==='all' ? orders : orders.filter(o=>o.order_type===filter),
    [orders,filter]
  )

  return (
    <Shell title="Kitchen Display" subtitle="Live order flow for kitchen staff">
      <div className="kds-toolbar">
        <div className="filter-pills">
          {['all','dinein','takeaway','delivery'].map(x=>(
            <button className={filter===x?'active':''} key={x} onClick={()=>setFilter(x)}>
              {x==='all'?'All':x==='dinein'?'Dine In':x[0].toUpperCase()+x.slice(1)}
            </button>
          ))}
        </div>
        <div className="kds-count">{filtered.length} active orders</div>
      </div>

      <div className="kds-board">
        {columns.map(col=>(
          <section className="kds-column" key={col.key}>
            <header>
              <span className={`status-dot ${col.key}`}></span>
              <strong>{col.title}</strong>
              <b>{filtered.filter(o=>o.status===col.key).length}</b>
            </header>

            <div className="kds-stack">
              {filtered.filter(o=>o.status===col.key).map(order=>(
                <article className="kds-card" key={order.id}>
                  <div className="kds-card-head">
                    <div>
                      <strong>#{order.id}</strong>
                      <span>{order.order_type.toUpperCase()}</span>
                    </div>
                    <time>{orderTime(order.created_at)}</time>
                  </div>

                  <div className="kds-items">
                    {order.items.map((item,i)=>(
                      <div key={i}>
                        <b>{item.qty}×</b>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>

                  {order.notes && <p className="order-note">{order.notes}</p>}

                  <button
                    className={`kds-action ${col.key}`}
                    onClick={()=>change(order.id,col.next)}
                  >
                    {col.action}
                  </button>
                </article>
              ))}

              {!filtered.some(o=>o.status===col.key) && (
                <div className="empty-column">No orders</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  )
}

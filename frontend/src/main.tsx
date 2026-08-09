import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
const API=(import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

type Item={id:number,name:string,category:string,price:number,active:boolean};
type Order={id:number,status:string,order_type:string,payment_method:string,total:number,items:{name:string,qty:number}[]};

function Nav(){return <div className="nav"><b>Restaurant POS</b><a href="/">Cashier</a><a href="/kitchen">Kitchen</a><a href="/admin">Admin</a></div>}

function Cashier(){
 const [menu,setMenu]=useState<Item[]>([]); const [cart,setCart]=useState<Record<number,number>>({}); const [pay,setPay]=useState('cash'); const [type,setType]=useState('takeaway');
 useEffect(()=>{fetch(API+'/menu').then(r=>r.json()).then(setMenu)},[]);
 const total=useMemo(()=>menu.reduce((s,i)=>s+(cart[i.id]||0)*i.price,0),[menu,cart]);
 const add=(id:number)=>setCart(c=>({...c,[id]:(c[id]||0)+1}));
 const submit=async()=>{const items=Object.entries(cart).filter(([,q])=>q>0).map(([id,q])=>({menu_item_id:+id,qty:q})); if(!items.length)return alert('Add items first'); const r=await fetch(API+'/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,order_type:type,payment_method:pay})}); const d=await r.json(); alert(`Order #${d.id} created. Total AED ${d.total}`); setCart({});};
 return <><Nav/><main><h1>Cashier POS</h1><div className="toolbar"><select value={type} onChange={e=>setType(e.target.value)}><option value="takeaway">Takeaway</option><option value="dinein">Dine In</option><option value="delivery">Delivery</option></select><select value={pay} onChange={e=>setPay(e.target.value)}><option value="cash">Cash</option><option value="card">Card</option></select></div><div className="grid">{menu.map(i=><button className="item" key={i.id} onClick={()=>add(i.id)}><b>{i.name}</b><span>{i.category}</span><strong>AED {i.price.toFixed(2)}</strong>{cart[i.id]?<em>Qty {cart[i.id]}</em>:null}</button>)}</div><div className="checkout"><div>Subtotal AED {total.toFixed(2)}</div><div>VAT 5% AED {(total*.05).toFixed(2)}</div><b>Total AED {(total*1.05).toFixed(2)}</b><button onClick={submit}>PLACE ORDER</button></div></main></>
}

function Kitchen(){const [orders,setOrders]=useState<Order[]>([]); const load=()=>fetch(API+'/orders').then(r=>r.json()).then((d:Order[])=>setOrders(d.filter(o=>!['completed','cancelled'].includes(o.status)))); useEffect(()=>{load();const t=setInterval(load,3000);return()=>clearInterval(t)},[]); const st=async(id:number,s:string)=>{await fetch(`${API}/orders/${id}/status/${s}`,{method:'PATCH'});load()}; return <><Nav/><main><h1>Kitchen KDS</h1><div className="orders">{orders.map(o=><div className="order" key={o.id}><h2>#{o.id} <small>{o.status.toUpperCase()}</small></h2>{o.items.map((x,j)=><p key={j}>{x.qty} × {x.name}</p>)}<div className="actions">{o.status==='new'&&<button onClick={()=>st(o.id,'preparing')}>Start Preparing</button>}{o.status==='preparing'&&<button onClick={()=>st(o.id,'ready')}>Ready</button>}{o.status==='ready'&&<button onClick={()=>st(o.id,'completed')}>Complete</button>}</div></div>)}</div></main></>}

function Admin(){const [items,setItems]=useState<Item[]>([]); const [rep,setRep]=useState<any>({}); const [name,setName]=useState('');const [cat,setCat]=useState('General');const [price,setPrice]=useState(''); const load=()=>{fetch(API+'/admin/menu').then(r=>r.json()).then(setItems);fetch(API+'/reports/today').then(r=>r.json()).then(setRep)}; useEffect(load,[]); const add=async()=>{if(!name||!price)return;await fetch(API+'/admin/menu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,category:cat,price:+price,active:true})});setName('');setPrice('');load()}; const del=async(id:number)=>{await fetch(API+'/admin/menu/'+id,{method:'DELETE'});load()};return <><Nav/><main><h1>Admin</h1><div className="stats"><div><b>{rep.orders||0}</b><span>Orders</span></div><div><b>AED {rep.sales||0}</b><span>Sales</span></div><div><b>AED {rep.cash||0}</b><span>Cash</span></div><div><b>AED {rep.card||0}</b><span>Card</span></div></div><section><h2>Add Menu Item</h2><div className="form"><input placeholder="Item name" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Category" value={cat} onChange={e=>setCat(e.target.value)}/><input placeholder="Price" type="number" value={price} onChange={e=>setPrice(e.target.value)}/><button onClick={add}>Add</button></div></section><section><h2>Menu</h2>{items.map(i=><div className="row" key={i.id}><span>{i.name} — {i.category}</span><b>AED {i.price.toFixed(2)}</b><button onClick={()=>del(i.id)}>Delete</button></div>)}</section></main></>}

function App(){const p=location.pathname; if(p.startsWith('/kitchen'))return <Kitchen/>; if(p.startsWith('/admin'))return <Admin/>; return <Cashier/>}
createRoot(document.getElementById('root')!).render(<App/>);

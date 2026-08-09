import React,{useEffect,useState} from 'react'
import {api,money} from '../api'
export default function CustomerDisplay(){
 const[o,setO]=useState<any>(null);const[settings,setSettings]=useState<any>({})
 useEffect(()=>{const load=()=>{api('/customer-display/current').then(setO).catch(()=>{});api('/settings').then(setSettings).catch(()=>{})};load();const t=setInterval(load,2000);return()=>clearInterval(t)},[])
 if(settings?.allow_customer_display===false)return <div className="closed-screen"><div><b>Display Disabled</b><span>Admin has disabled customer display.</span></div></div>
 return <div className="customer-display-screen"><header><div className="brand-mark">M</div><div><h1>{settings.shop_name||'MAHI POS'}</h1><p>Thank you for your order</p></div></header>{!o?<main className="display-empty"><b>Welcome</b><span>Your order will appear here</span></main>:<main className="display-order"><section><h2>Order #{o.id}</h2>{o.items.map((i:any,k:number)=><div className="display-line" key={k}><span>{i.qty} × {i.name}</span><b>{money(i.qty*i.unit_price)}</b></div>)}</section><aside><div><span>Subtotal</span><b>{money(o.subtotal)}</b></div><div><span>Discount</span><b>{money(o.discount)}</b></div><div><span>VAT</span><b>{money(o.vat)}</b></div><div className="display-total"><span>Total</span><b>{money(o.total)}</b></div></aside></main>}</div>
}

import type { Settings } from './types'

export const API =
  (import.meta as any).env.VITE_API_URL ||
  'http://localhost:8000'

export const PRINT_BRIDGE = 'http://127.0.0.1:18181'

export async function api<T=any>(
  path:string,
  options:RequestInit={}
):Promise<T>{
  const res = await fetch(API + path, options)
  const data = await res.json().catch(()=>({}))
  if(!res.ok){
    throw new Error((data as any).detail || (data as any).error || 'Request failed')
  }
  return data as T
}

export async function sendToIpPrinter(order:any, settings:Settings){
  if(!settings?.printer_ip) throw new Error('Printer IP is empty')

  const lines:string[] = []
  lines.push(settings.shop_name || 'Restaurant POS')
  if(settings.shop_address) lines.push(settings.shop_address)
  if(settings.shop_phone) lines.push(settings.shop_phone)
  lines.push('--------------------------------')
  lines.push(`Order #${order.id}  ${String(order.order_type || '').toUpperCase()}`)
  if(order.table) lines.push(`Table: ${order.table}`)
  if(order.waiter) lines.push(`Waiter: ${order.waiter}`)
  lines.push('--------------------------------')

  for(const i of order.items || []){
    const amount = (Number(i.qty) * Number(i.unit_price)).toFixed(2)
    lines.push(`${i.qty} x ${i.name}`)
    lines.push(`                        ${amount}`)
  }

  lines.push('--------------------------------')
  lines.push(`Subtotal AED ${Number(order.subtotal || 0).toFixed(2)}`)
  if(Number(order.discount || 0) > 0){
    lines.push(`Discount AED ${Number(order.discount).toFixed(2)}`)
  }
  lines.push(`VAT AED ${Number(order.vat || 0).toFixed(2)}`)
  lines.push(`TOTAL AED ${Number(order.total || 0).toFixed(2)}`)
  lines.push(`Payment: ${String(order.payment_method || '').toUpperCase()}`)
  lines.push('--------------------------------')
  if(settings.receipt_footer) lines.push(settings.receipt_footer)

  const payload = {
    ip: settings.printer_ip,
    port: Number(settings.printer_port || 9100),
    lines,
    cut: true
  }

  const nativePrinter = (window as any).AndroidPrinter
  if(nativePrinter && typeof nativePrinter.printReceipt === 'function'){
    const result = nativePrinter.printReceipt(JSON.stringify(payload))
    let parsed:any = result
    try{ parsed = JSON.parse(result) }catch{}
    if(parsed && parsed.ok === false){
      throw new Error(parsed.error || 'Android printer error')
    }
    return parsed || {ok:true}
  }

  const res = await fetch(PRINT_BRIDGE + '/print',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  })
  const data = await res.json().catch(()=>({}))
  if(!res.ok) throw new Error((data as any).error || 'Printer bridge error')
  return data
}

export function money(value:number|undefined|null){
  return `AED ${Number(value || 0).toFixed(2)}`
}

export function orderTime(value:string){
  try{
    return new Date(value).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
  }catch{
    return ''
  }
}

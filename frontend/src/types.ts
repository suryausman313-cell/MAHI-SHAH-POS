export type MenuItem = {
  id:number
  name:string
  category:string
  price:number
  active:boolean
}

export type PosTable = {
  id:number
  name:string
  seats:number
  status:string
}

export type Staff = {
  id:number
  name:string
  role:string
  pin:string
  active:boolean
}

export type InventoryItem = {
  id:number
  name:string
  unit:string
  qty:number
  min_qty:number
  cost:number
  low:boolean
}

export type OrderItem = {
  name:string
  qty:number
  unit_price:number
  notes?:string
}

export type Order = {
  id:number
  status:string
  order_type:string
  table_id?:number|null
  waiter_id?:number|null
  payment_method:string
  subtotal:number
  discount:number
  vat:number
  total:number
  notes:string
  created_at:string
  items:OrderItem[]
}

export type Settings = {
  shop_name:string
  shop_phone:string
  shop_address:string
  vat_percent:number
  receipt_footer:string
  printer_ip:string
  printer_port:number
  auto_print:boolean
}

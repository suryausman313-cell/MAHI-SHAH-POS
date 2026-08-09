export type MenuItem = {
  id:number
  name:string
  category:string
  price:number
  active:boolean
  barcode?:string
  sku?:string
  modifiers?:{id:number;name:string;price:number}[]
  image?:string
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
  cash_paid?:number
  card_paid?:number
  refund_amount?:number
  customer_id?:number|null
  customer?:string|null
  shift_id?:number|null
  delivery_address?:string
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
  trn?:string
  kitchen_sound?:boolean
  require_shift?:boolean
  currency?:string
  payment_terminal_provider?:string
  payment_terminal_enabled?:boolean
  app_enabled?:boolean
  shop_open?:boolean
  vat_enabled?:boolean
  vat_inclusive?:boolean
  cashier_card_size?:string
  allow_discounts?:boolean
  allow_coupons?:boolean
  allow_refunds?:boolean
  allow_voids?:boolean
  allow_hold_orders?:boolean
  allow_split_payment?:boolean
  allow_delivery?:boolean
  allow_dinein?:boolean
  allow_takeaway?:boolean
  allow_customer_display?:boolean
  allow_waiter_payment?:boolean
  kitchen_can_cancel?:boolean
  manager_pin_required_for_kitchen_cancel?:boolean
  show_prices_in_kitchen?:boolean
  show_shift_to_waiter?:boolean
  show_shift_to_kitchen?:boolean
  auto_cash_drawer?:boolean
}

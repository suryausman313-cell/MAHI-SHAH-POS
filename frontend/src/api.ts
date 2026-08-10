import type { Settings } from './types'

export const API =
  (import.meta as any).env.VITE_API_URL ||
  'http://localhost:8000'

export const PRINT_BRIDGE = 'http://127.0.0.1:18181'

function isNetworkError(err: any) {
  if (!err) return false
  if (err instanceof TypeError) return true

  const msg = String(err?.message || err).toLowerCase()

  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  )
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let res: Response

  try {
    res = await fetch(API + path, options)
  } catch (err: any) {
    // Sirf real network failure par offline queue
    if (
      path === '/orders' &&
      (options.method || 'GET').toUpperCase() === 'POST' &&
      isNetworkError(err)
    ) {
      const queue = JSON.parse(
        localStorage.getItem('mahi_offline_orders') || '[]'
      )

      queue.push({
        path,
        options,
        queued_at: new Date().toISOString()
      })

      localStorage.setItem(
        'mahi_offline_orders',
        JSON.stringify(queue)
      )

      throw new Error(
        'Internet unavailable. Order saved in offline queue; reconnect and sync before closing shift.'
      )
    }

    throw err
  }

  let data: any = {}

  try {
    data = await res.json()
  } catch {
    try {
      data = { detail: await res.text() }
    } catch {
      data = {}
    }
  }

  if (!res.ok) {
    const detail =
      data?.detail ||
      data?.error ||
      data?.message ||
      `Server error ${res.status}`

    if (Array.isArray(detail)) {
      const readable = detail
        .map((x: any) => {
          const where = Array.isArray(x?.loc)
            ? x.loc.join('.')
            : ''

          return `${where}${where ? ': ' : ''}${x?.msg || 'Invalid value'}`
        })
        .join('\n')

      throw new Error(
        readable || `Server error ${res.status}`
      )
    }

    throw new Error(
      typeof detail === 'string'
        ? detail
        : JSON.stringify(detail)
    )
  }

  return data as T
}

export async function syncOfflineOrders() {
  const queue: any[] = JSON.parse(
    localStorage.getItem('mahi_offline_orders') || '[]'
  )

  if (!queue.length) {
    return {
      synced: 0,
      remaining: 0
    }
  }

  const remaining: any[] = []
  let synced = 0

  for (const job of queue) {
    try {
      const res = await fetch(
        API + job.path,
        job.options
      )

      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({}))

        console.error(
          'Queued order rejected by server',
          res.status,
          data
        )

        continue
      }

      synced++
    } catch {
      remaining.push(job)
    }
  }

  localStorage.setItem(
    'mahi_offline_orders',
    JSON.stringify(remaining)
  )

  return {
    synced,
    remaining: remaining.length
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'online',
    () => {
      syncOfflineOrders().catch(console.error)
    }
  )
}

export async function sendToIpPrinter(
  order: any,
  settings: Settings
) {
  if (!settings?.printer_ip) {
    throw new Error('Printer IP is empty')
  }

  const lines: string[] = []

  lines.push(
    settings.shop_name ||
    'Restaurant POS'
  )

  if (settings.shop_address) {
    lines.push(settings.shop_address)
  }

  if (settings.shop_phone) {
    lines.push(settings.shop_phone)
  }

  lines.push('--------------------------------')

  lines.push(
    `Order #${order.id}  ${String(order.order_type || '').toUpperCase()}`
  )

  if (order.table) {
    lines.push(`Table: ${order.table}`)
  }

  if (order.waiter) {
    lines.push(`Staff: ${order.waiter}`)
  }

  lines.push('--------------------------------')

  for (const i of order.items || []) {
    const amount = (
      Number(i.qty) *
      Number(i.unit_price)
    ).toFixed(2)

    let itemName = i.name || 'Item'

    if (i.size_name) {
      itemName += ` · ${i.size_name}`
    }

    lines.push(
      `${i.qty} x ${itemName}`
    )

    lines.push(
      `                        ${amount}`
    )
  }

  lines.push('--------------------------------')

  lines.push(
    `Subtotal AED ${Number(order.subtotal || 0).toFixed(2)}`
  )

  if (Number(order.discount || 0) > 0) {
    lines.push(
      `Discount AED ${Number(order.discount).toFixed(2)}`
    )
  }

  if (
    settings.vat_enabled !== false &&
    Number(order.vat || 0) > 0
  ) {
    if (settings.vat_inclusive !== false) {
      lines.push('VAT Included')
    } else {
      lines.push(
        `VAT AED ${Number(order.vat || 0).toFixed(2)}`
      )
    }
  }

  lines.push(
    `TOTAL AED ${Number(order.total || 0).toFixed(2)}`
  )

  lines.push(
    `Payment: ${String(order.payment_method || '').toUpperCase()}`
  )

  lines.push('--------------------------------')

  if (settings.receipt_footer) {
    lines.push(settings.receipt_footer)
  }

  const payload = {
    ip: settings.printer_ip,
    port: Number(
      settings.printer_port || 9100
    ),
    lines,
    cut: true
  }

  const nativePrinter =
    (window as any).AndroidPrinter

  if (
    nativePrinter &&
    typeof nativePrinter.printReceipt === 'function'
  ) {
    const result =
      nativePrinter.printReceipt(
        JSON.stringify(payload)
      )

    let parsed: any = result

    try {
      parsed = JSON.parse(result)
    } catch {}

    if (parsed && parsed.ok === false) {
      throw new Error(
        parsed.error ||
        'Android printer error'
      )
    }

    return parsed || { ok: true }
  }

  const res = await fetch(
    PRINT_BRIDGE + '/print',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  )

  const data = await res
    .json()
    .catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      (data as any).error ||
      'Printer bridge error'
    )
  }

  return data
}

export function money(
  value: number | undefined | null
) {
  return `AED ${Number(value || 0).toFixed(2)}`
}

export function orderTime(value: string) {
  try {
    return new Date(value)
      .toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      )
  } catch {
    return ''
  }
}

export async function openCashDrawer(
  settings: Settings
) {
  if (!settings?.printer_ip) {
    throw new Error(
      'Printer IP is empty'
    )
  }

  const payload = {
    ip: settings.printer_ip,
    port: Number(
      settings.printer_port || 9100
    )
  }

  const nativePrinter =
    (window as any).AndroidPrinter

  if (
    nativePrinter &&
    typeof nativePrinter.openDrawer === 'function'
  ) {
    const result =
      nativePrinter.openDrawer(
        JSON.stringify(payload)
      )

    let parsed: any = result

    try {
      parsed = JSON.parse(result)
    } catch {}

    if (parsed && parsed.ok === false) {
      throw new Error(
        parsed.error ||
        'Cash drawer error'
      )
    }

    return parsed || { ok: true }
  }

  const res = await fetch(
    PRINT_BRIDGE + '/drawer',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  )

  const data = await res
    .json()
    .catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      (data as any).error ||
      'Cash drawer bridge error'
    )
  }

  return data
}

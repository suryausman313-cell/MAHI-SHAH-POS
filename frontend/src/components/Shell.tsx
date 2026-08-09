import React from 'react'

const links = [
  ['/', '▦', 'Cashier'],
  ['/waiter', '☰', 'Waiter'],
  ['/kitchen', '♨', 'Kitchen'],
  ['/tables', '▤', 'Tables'],
  ['/customer-display', '▣', 'Display'],
  ['/admin', '⚙', 'Admin'],
]

export default function Shell({
  title,
  subtitle,
  children,
  compact=false
}:{
  title:string
  subtitle?:string
  children:React.ReactNode
  compact?:boolean
}){
  const path = location.pathname
  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>MAHI POS</strong>
            <span>Restaurant System</span>
          </div>
        </div>

        <nav>
          {links.map(([href,icon,label])=>{
            const active = href==='/' ? path==='/' : path.startsWith(href)
            return (
              <a className={active?'active':''} href={href} key={href}>
                <i>{icon}</i>
                <span>{label}</span>
              </a>
            )
          })}
        </nav>

        <div className="side-footer">
          <span className="live-dot"></span>
          System Online
        </div>
      </aside>

      <section className="app-main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="top-actions">
            <span className="terminal-pill">Terminal 01</span>
            <span className="clock">{new Date().toLocaleDateString()}</span>
          </div>
        </header>
        <div className={compact ? 'page compact' : 'page'}>{children}</div>
      </section>
    </div>
  )
}

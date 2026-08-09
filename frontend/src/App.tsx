import React from 'react'
import Cashier from './pages/Cashier'
import Waiter from './pages/Waiter'
import Kitchen from './pages/Kitchen'
import Tables from './pages/Tables'
import Admin from './pages/Admin'

export default function App(){
  const p = location.pathname
  if(p.startsWith('/waiter')) return <Waiter/>
  if(p.startsWith('/kitchen')) return <Kitchen/>
  if(p.startsWith('/tables')) return <Tables/>
  if(p.startsWith('/admin')) return <Admin/>
  return <Cashier/>
}

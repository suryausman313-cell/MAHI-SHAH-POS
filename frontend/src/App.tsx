import React from 'react'
import Cashier from './pages/Cashier'
import Waiter from './pages/Waiter'
import Kitchen from './pages/Kitchen'
import Tables from './pages/Tables'
import Admin from './pages/Admin'
import Login from './pages/Login'
import CustomerDisplay from './pages/CustomerDisplay'

export default function App(){
 const p=location.pathname
 if(p.startsWith('/login'))return <Login/>
 if(p.startsWith('/customer-display'))return <CustomerDisplay/>
 const raw=localStorage.getItem('mahi_user')
 if(!raw && p!=='/'){ return <Login/> }
 if(p.startsWith('/waiter'))return <Waiter/>
 if(p.startsWith('/kitchen'))return <Kitchen/>
 if(p.startsWith('/tables'))return <Tables/>
 if(p.startsWith('/admin'))return <Admin/>
 return <Cashier/>
}

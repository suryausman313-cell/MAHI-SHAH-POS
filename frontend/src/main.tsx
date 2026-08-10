import React from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import './styles.css'
const p=location.pathname
const role=p.startsWith('/admin')?'admin':p.startsWith('/waiter')?'waiter':'cashier'
const m=document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
if(m)m.href=`/${role}.webmanifest`
const a=document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
if(a)a.href=`/icons/${role}-192.png`
document.title=`MAHI SHAH POS ${role.charAt(0).toUpperCase()+role.slice(1)}`
createRoot(document.getElementById('root')!).render(<App/>)
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(console.error))

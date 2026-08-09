import React,{useState} from 'react'
import {api} from '../api'

export default function Login(){
  const[pin,setPin]=useState('')
  const[loading,setLoading]=useState(false)
  const press=(n:string)=>setPin(p=>(p+n).slice(0,8))
  const go=async()=>{
    if(!pin)return
    setLoading(true)
    try{
      const u:any=await api('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})})
      localStorage.setItem('mahi_user',JSON.stringify(u))
      const target=u.role==='kitchen'?'/kitchen':u.role==='waiter'?'/waiter':u.role==='admin'||u.role==='manager'?'/admin':'/'
      location.href=target
    }catch(e:any){alert(e.message);setPin('')}finally{setLoading(false)}
  }
  return <div className="login-screen"><div className="login-card"><div className="brand-mark big">M</div><h1>MAHI POS</h1><p>Enter staff PIN</p><div className="pin-dots">{pin.split('').map((_,i)=><i key={i}></i>)}</div><div className="pin-grid">{['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k=><button key={k} onClick={()=>k==='C'?setPin(''):k==='⌫'?setPin(p=>p.slice(0,-1)):press(k)}>{k}</button>)}</div><button className="pay-button" disabled={loading} onClick={go}>{loading?'Checking...':'LOGIN'}</button></div></div>
}

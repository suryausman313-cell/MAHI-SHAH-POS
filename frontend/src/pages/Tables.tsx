import React,{useEffect,useState} from 'react'
import Shell from '../components/Shell'
import {api} from '../api'
import type {PosTable} from '../types'

export default function Tables(){
 const[tables,setTables]=useState<PosTable[]>([]);const[reservations,setReservations]=useState<any[]>([]);const[edit,setEdit]=useState(false)
 const load=async()=>{setTables(await api('/tables'));setReservations(await api('/reservations'))}
 useEffect(()=>{load().catch(console.error)},[])
 const move=async(t:any)=>{if(!edit)return;const x=prompt('X position',String(t.x||0));const y=prompt('Y position',String(t.y||0));if(x===null||y===null)return;await api(`/tables/${t.id}/position`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:+x||0,y:+y||0})});await load()}
 const reserve=async()=>{const name=prompt('Customer name');if(!name)return;const phone=prompt('Phone')||'';const party=prompt('Party size','2')||'2';const when=prompt('Date/time e.g. 2026-08-10T19:30');if(!when)return;const table=prompt('Table ID (optional)','');await api('/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_name:name,phone,party_size:+party,table_id:table?+table:null,reservation_at:when,notes:''})});await load()}
 return <Shell title="Tables & Reservations" subtitle="Floor plan and bookings"><div className="table-summary"><button className="secondary-btn" onClick={()=>setEdit(!edit)}>{edit?'Finish Floor Edit':'Edit Floor Plan'}</button><button className="primary-btn" onClick={reserve}>New Reservation</button></div><div className="floor-grid">{tables.map((t:any)=><article onClick={()=>move(t)} className={`floor-table ${t.status} ${edit?'editing':''}`} style={edit?{transform:`translate(${Math.min(40,t.x||0)}px,${Math.min(40,t.y||0)}px)`}:undefined} key={t.id}><div className="table-icon">▦</div><h3>{t.name}</h3><p>{t.seats} seats</p><span>{t.status}</span></article>)}</div><div className="panel-card reservations-panel"><div className="panel-title"><h3>Reservations</h3></div>{reservations.map(r=><div className="simple-row" key={r.id}><span><b>{r.customer_name}</b> · {new Date(r.reservation_at).toLocaleString()} · {r.party_size} guests</span><em className={`status-badge ${r.status==='cancelled'?'cancelled':'ready'}`}>{r.status}</em></div>)}</div></Shell>
}

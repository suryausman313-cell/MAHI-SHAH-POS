import React, {useEffect, useState} from 'react'
import Shell from '../components/Shell'
import {api} from '../api'
import type {PosTable} from '../types'

export default function Tables(){
  const [tables,setTables] = useState<PosTable[]>([])
  const load=()=>api<PosTable[]>('/tables').then(setTables)

  useEffect(()=>{load().catch(console.error)},[])

  return (
    <Shell title="Tables" subtitle="Dining room overview">
      <div className="table-summary">
        <div><span className="legend available"></span>Available <b>{tables.filter(t=>t.status==='available').length}</b></div>
        <div><span className="legend occupied"></span>Occupied <b>{tables.filter(t=>t.status==='occupied').length}</b></div>
      </div>

      <div className="floor-grid">
        {tables.map(t=>(
          <article className={`floor-table ${t.status}`} key={t.id}>
            <div className="table-icon">▦</div>
            <h3>{t.name}</h3>
            <p>{t.seats} seats</p>
            <span>{t.status}</span>
          </article>
        ))}
      </div>
    </Shell>
  )
}

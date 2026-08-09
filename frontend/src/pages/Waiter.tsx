import React from 'react'
import Shell from '../components/Shell'
import OrderBuilder from '../components/OrderBuilder'

export default function Waiter(){
  return (
    <Shell title="Waiter" subtitle="Take dine-in orders from any table" compact>
      <OrderBuilder waiterMode/>
    </Shell>
  )
}

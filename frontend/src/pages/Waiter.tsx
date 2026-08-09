import React from 'react'
import Shell from '../components/Shell'
import OrderBuilder from '../components/OrderBuilder'
export default function Waiter(){return <Shell title="Waiter" subtitle="Take dine-in orders and send them to kitchen" compact><OrderBuilder waiterMode/></Shell>}

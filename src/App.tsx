import { useEffect, useState } from 'react'
import { ToastProvider } from './lib/toast'
import { useTodayKey } from './lib/hooks'
import type { Meal } from './db'
import Today from './screens/Today'
import AddFood from './screens/AddFood'
import Weight from './screens/Weight'
import Settings from './screens/Settings'

const TABS = [
  { id: 'today', label: 'Vandaag', icon: '🏠' },
  { id: 'weight', label: 'Gewicht', icon: '⚖️' },
  { id: 'settings', label: 'Instellingen', icon: '⚙️' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [adding, setAdding] = useState(false)
  const [meal, setMeal] = useState<Meal>('eerste')
  const todayKey = useTodayKey()
  const [override, setOverride] = useState<string | null>(null)
  const day = override ?? todayKey
  const setDay = (d: string) => setOverride(d === todayKey ? null : d)
  function openAdd(m?: Meal) {
    if (m) setMeal(m)
    if (!adding) history.pushState({ add: true }, '')
    setAdding(true)
  }
  function closeAdd() {
    if (history.state?.add) history.back()
    else setAdding(false)
  }
  useEffect(() => {
    const onPop = () => setAdding(false)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // Alle schermen blijven gemount (alleen verborgen) zodat zoekterm, filter en scrollpositie bewaard blijven.
  return (
    <ToastProvider>
      <main>
        <section hidden={adding || tab !== 'today'}><Today day={day} setDay={setDay} todayKey={todayKey} goAdd={openAdd} /></section>
        <section hidden={!adding}><AddFood day={day} todayKey={todayKey} meal={meal} setMeal={setMeal} onBack={closeAdd} /></section>
        <section hidden={adding || tab !== 'weight'}><Weight /></section>
        <section hidden={adding || tab !== 'settings'}><Settings /></section>
      </main>
      <nav hidden={adding}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </ToastProvider>
  )
}

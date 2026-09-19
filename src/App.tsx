import { useEffect } from 'react'
import Globe from './components/Globe'
import Sidebar from './components/Sidebar'
import Timeline from './components/Timeline'
import { useStore } from './store'

export default function App() {
  useEffect(() => {
    void useStore.getState().init()
  }, [])

  return (
    <div className="app">
      <Sidebar />
      <main className="stage">
        <Globe />
        <Timeline />
      </main>
    </div>
  )
}

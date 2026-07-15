import { Routes, Route } from 'react-router-dom'
import AppFrame from './components/AppFrame'
import Home from './pages/Home'
import Monthly from './pages/Monthly'
import Assets from './pages/Assets'
import Yearly from './pages/Yearly'
import Settings from './pages/Settings'
import Checkup from './pages/Checkup'

export default function App() {
  return (
    <Routes>
      <Route element={<AppFrame />}>
        <Route path="/" element={<Home />} />
        <Route path="/monthly" element={<Monthly />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/yearly" element={<Yearly />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/checkup" element={<Checkup />} />
    </Routes>
  )
}

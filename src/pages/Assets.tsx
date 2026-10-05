import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import AssetGlance from '../components/AssetGlance'
import Card from '../components/Card'
import { useLedgerStore } from '../lib/store'
import { resolveSnapshot, totalAssets } from '../lib/carryover'
import { krwOf, useFxRates } from '../lib/fx'
import { currentYm } from '../lib/format'
import { assetSeries, isOwned } from '../lib/assetGlance'

/**
 * 자산 탭 — 한 화면에 담아 캡처 한 장으로 보이게 (2026-10-05).
 *
 * 예전 '자세히'(목표 카드·순자산 차트·도넛·계좌 카드)는 뺐다. 길이가 폰 세 장이 넘어
 * 한눈에 안 들어왔다. 함께 = 전체 자산 기준 그래프, 사람을 고르면 엑셀처럼 칸 나눈 표.
 * 고치기는 오른쪽 위 연필 → 자산 등록 화면.
 */
export default function Assets() {
  const navigate = useNavigate()
  const { snapshots, profile } = useLedgerStore()
  const rates = useFxRates()
  const latestYm = snapshots.length ? snapshots[snapshots.length - 1].ym : currentYm()

  const stored = resolveSnapshot(snapshots, latestYm)
  // 외화 항목은 실시간 환율로 원화 환산 (현재 화면 기준)
  const items = stored.items.map((it) => ({ ...it, amount: krwOf(it, rates) }))
  const assets = totalAssets({ ...stored, items })

  const childNames = profile.childNames ?? []
  const owners = [profile.member1Name, profile.member2Name, '공동', ...childNames]

  // 누구 것을 볼지 — 항목이 있는 사람만 버튼으로 (빈 화면을 눌러보게 만들지 않는다)
  const ALL = '함께'
  const [tab, setTab] = useState(ALL)
  const ownerTabs = owners.filter((name) => items.some((it) => isOwned(it.owner, name)))
  const showTabs = items.length > 0 && ownerTabs.length > 1
  const picked = showTabs && tab !== ALL ? tab : null

  // 전체 자산 흐름 — 마지막(지금) 점은 실시간 환율 반영값으로 맞춘다
  const series = assetSeries(snapshots, latestYm, 5).map((d, i, arr) =>
    i === arr.length - 1 ? { ...d, value: assets } : d,
  )

  return (
    <div className="animate-fade-up space-y-4">
      <header className="flex items-center justify-between gap-2 px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">우리집 자산</h1>
        <button
          onClick={() => navigate('/asset-setup')}
          className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand active:bg-brand/20"
        >
          <Pencil size={12} /> 등록·수정
        </button>
      </header>

      {items.length === 0 && (
        <Card onClick={() => navigate('/asset-setup')}>
          <p className="text-[15px] font-bold text-ink">아직 등록된 자산이 없어요</p>
          <p className="mt-1 text-[13px] text-sub">
            어떤 통장에 얼마 있는지 남편·아내 각자 등록해 보세요
          </p>
        </Card>
      )}

      {showTabs && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {[ALL, ...ownerTabs].map((name) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                tab === name ? 'bg-ink text-white' : 'bg-card text-sub shadow-card active:bg-line'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <AssetGlance items={items} picked={picked} owners={owners} ym={latestYm} series={series} />
    </div>
  )
}

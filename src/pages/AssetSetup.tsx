import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Baby, ChevronLeft, ChevronRight, UserRound } from 'lucide-react'
import AssetEditor from '../components/AssetEditor'
import { useLedgerStore } from '../lib/store'
import { activeYm, genId, netWorthOf, resolveSnapshot } from '../lib/carryover'
import { abbreviateKRW } from '../lib/format'
import type { AssetItem } from '../types'

/**
 * 자산 등록·수정 플로우 — 어떤 통장에 얼마 있는지 남편/아내가 각자 입력.
 * 정산과 별개로 언제든 진입 가능 (홈 빈 상태 카드 · 자산 탭에서).
 */
export default function AssetSetup() {
  const navigate = useNavigate()
  const { ledgers, snapshots, profile, memberNo, saveSnapshot } = useLedgerStore()

  const [ym] = useState(() => activeYm(ledgers))
  const [assets, setAssets] = useState<AssetItem[]>(
    () => resolveSnapshot(snapshots, ym).items.map((it) => ({ ...it })),
  )
  // 선택된 소유자 이름 (부부 또는 자녀)
  const [selName, setSelName] = useState<string | null>(null)

  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]
  const childNames = profile.childNames ?? []
  const isChild = selName ? childNames.includes(selName) : false

  const setAmount = (id: string, amount: number) =>
    setAssets((prev) => prev.map((it) => (it.id === id ? { ...it, amount } : it)))
  const setNote = (id: string, note: string) =>
    setAssets((prev) =>
      prev.map((it) => (it.id === id ? { ...it, note: note || undefined } : it)),
    )
  const updateAsset = (id: string, patch: Partial<Omit<AssetItem, 'id'>>) =>
    setAssets((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const addAsset = (asset: Omit<AssetItem, 'id'>) =>
    setAssets((prev) => [...prev, { ...asset, id: genId() }])
  const removeAsset = (id: string) => setAssets((prev) => prev.filter((it) => it.id !== id))

  const save = () => {
    saveSnapshot({ ym, items: assets })
    navigate('/assets')
  }

  // ── 구성원 선택 (부부 + 자녀) ─────────────
  if (!selName) {
    return (
      <Frame>
        <Header onBack={() => navigate(-1)} title="자산 등록" subtitle="어떤 통장에 얼마 있는지 확인해 봐요" />
        <div className="flex-1 space-y-3 px-5 pt-4">
          {([1, 2] as const).map((m) => {
            const count = assets.filter(
              (a) => a.owner === memberNames[m - 1] || a.owner === '공동' || !a.owner,
            ).length
            return (
              <button
                key={m}
                onClick={() => setSelName(memberNames[m - 1])}
                className="flex w-full items-center gap-4 rounded-card bg-card px-5 py-5 text-left shadow-card transition-transform active:scale-[0.98]"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    m === 1 ? 'bg-brand/10 text-brand' : 'bg-pink-50 text-pink-500'
                  }`}
                >
                  <UserRound size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-[17px] font-bold text-ink">
                    {memberNames[m - 1]}
                    {memberNo === m && (
                      <span className="ml-1.5 rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-sub">
                        나
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] text-sub">
                    {count > 0 ? `등록된 계좌 ${count}개 · 수정할 수 있어요` : '아직 등록한 계좌가 없어요'}
                  </p>
                </div>
                <ChevronRight size={20} className="text-cap" />
              </button>
            )
          })}

          {/* 자녀 카드 — 설정 > 부부 정보에서 자녀를 추가하면 나타나요 */}
          {childNames.map((c) => {
            const count = assets.filter((a) => a.owner === c).length
            return (
              <button
                key={c}
                onClick={() => setSelName(c)}
                className="flex w-full items-center gap-4 rounded-card bg-card px-5 py-5 text-left shadow-card transition-transform active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Baby size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-[17px] font-bold text-ink">{c}</p>
                  <p className="mt-0.5 text-[13px] text-sub">
                    {count > 0 ? `등록된 계좌 ${count}개 · 수정할 수 있어요` : '아직 등록한 계좌가 없어요'}
                  </p>
                </div>
                <ChevronRight size={20} className="text-cap" />
              </button>
            )
          })}

          <p className="px-1 pt-2 text-[12px] leading-relaxed text-cap">
            각자 자기 통장과 공동 통장을 입력하면 우리집 순자산이 계산돼요.
            {childNames.length === 0 &&
              ' 자녀 통장은 설정 > 부부 정보에서 자녀를 추가하면 관리할 수 있어요.'}
          </p>
        </div>
      </Frame>
    )
  }

  // ── 자산 입력 ─────────────────────────────
  // 부부: 본인 + 공동 + 자녀 계좌 / 자녀 선택 시: 그 자녀 계좌만
  const visibleAssets = isChild
    ? assets.filter((a) => a.owner === selName)
    : assets.filter(
        (a) =>
          !a.owner ||
          a.owner === '공동' ||
          a.owner === selName ||
          childNames.includes(a.owner),
      )
  const netWorth = netWorthOf({ ym, items: assets })

  return (
    <Frame>
      <Header
        onBack={() => setSelName(null)}
        title="자산 등록"
        subtitle={
          isChild
            ? `${selName} · 자녀 앞으로 모아둔 통장을 입력해요`
            : `${selName} · 내 통장과 공동 통장을 입력해요`
        }
      />
      <div className="flex-1 px-5 pb-32">
        <AssetEditor
          assets={visibleAssets}
          ownerOptions={['공동', ...memberNames, ...childNames]}
          defaultOwner={selName}
          onChange={setAmount}
          onNote={setNote}
          onUpdate={updateAsset}
          onAdd={addAsset}
          onRemove={removeAsset}
        />
      </div>
      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-app -translate-x-1/2 border-t border-line/60 bg-bg/95 px-5 pb-4 pt-3 backdrop-blur">
        <p className="mb-2 text-center text-[12px] text-sub">
          우리집 순자산 <b className="tnum text-ink">{abbreviateKRW(netWorth)}</b>
        </p>
        <button
          onClick={save}
          className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
        >
          저장하기
        </button>
      </div>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </div>
  )
}

function Header({
  onBack,
  title,
  subtitle,
}: {
  onBack: () => void
  title: string
  subtitle: string
}) {
  return (
    <div className="sticky top-0 z-20 bg-bg px-5 pb-4 pt-4">
      <button onClick={onBack} className="mb-3 text-ink active:opacity-60" aria-label="뒤로">
        <ChevronLeft size={26} />
      </button>
      <h1 className="text-[24px] font-extrabold text-ink">{title}</h1>
      <p className="mt-1 text-[14px] text-sub">{subtitle}</p>
    </div>
  )
}

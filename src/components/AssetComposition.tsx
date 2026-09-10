import Card from './Card'
import { DEPOSIT, buildComposition, compositionNote, type CompoSlice } from '../lib/assetComposition'
import { ASSET_GROUP_LABEL } from '../lib/constants'
import { abbreviateKRW } from '../lib/format'
import type { AssetItem } from '../types'

/**
 * 자산 구성 막대.
 *
 * 파랑은 모으는 돈, 분홍은 불리는 돈 — 앱 이름(모아·불리) 그대로다.
 * 색만으로는 왜 파랑이 둘인지 설명이 안 되므로 목록에 소제목을 단다.
 *
 * recharts를 쓰지 않는다. 차트 묶음이 434KB인데 이 막대 하나 때문에
 * 자산 화면에서 그걸 받아오게 할 이유가 없다.
 */

const COLOR: Record<string, string> = {
  cash: '#3182F6',
  pension: '#85B7EB',
  deposit: '#B5D4F4', // 전세·월세 보증금 — 돌려받을 돈이라 '모으는 돈' 쪽 옅은 파랑
  stock: '#D4537E',
  realestate: '#ED93B1',
  other: '#B4B2A9',
}

const colorOf = (s: CompoSlice) => COLOR[s.group ?? 'other'] ?? COLOR.other
const labelOf = (s: CompoSlice) =>
  s.group === null ? '기타' : s.group === DEPOSIT ? '보증금' : ASSET_GROUP_LABEL[s.group]

export default function AssetComposition({ items }: { items: AssetItem[] }) {
  const c = buildComposition(items)
  // 한 칸뿐이면 비율이랄 게 없다 (전부 100%짜리 막대 하나)
  if (c.slices.length < 2) return null

  const note = compositionNote(c)
  const saves = c.slices.filter((s) => s.kind === 'save')
  const grows = c.slices.filter((s) => s.kind === 'grow')
  const others = c.slices.filter((s) => s.kind === 'other')

  return (
    <Card>
      <p className="mb-2.5 text-[15px] font-bold text-ink">자산 구성</p>

      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {c.slices.map((s) => (
          <div
            key={s.group ?? 'other'}
            style={{ width: `${s.percent}%`, background: colorOf(s) }}
          />
        ))}
      </div>

      <div className="mt-2">
        {saves.length > 0 && <GroupLabel text="모으는 돈" />}
        {saves.map((s) => (
          <Row key={s.group} slice={s} />
        ))}
        {grows.length > 0 && <GroupLabel text="불리는 돈" />}
        {grows.map((s) => (
          <Row key={s.group} slice={s} />
        ))}
        {others.map((s) => (
          <div key="other" className="mt-1 border-t border-line pt-1">
            <Row slice={s} />
          </div>
        ))}
      </div>

      {note && (
        <p className="mt-2.5 border-t border-line pt-2 text-[11.5px] leading-relaxed text-cap">
          {note}
        </p>
      )}
    </Card>
  )
}

function GroupLabel({ text }: { text: string }) {
  return <p className="mb-0.5 mt-1.5 text-[10.5px] text-cap">{text}</p>
}

function Row({ slice }: { slice: CompoSlice }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: colorOf(slice) }}
      />
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{labelOf(slice)}</span>
      {/* 같은 화면의 그룹 목록이 '3,275만원'식이라 여기만 원 단위면 두 표기가 섞인다 */}
      <span className="tnum shrink-0 text-[13px] text-sub">{abbreviateKRW(slice.amount)}</span>
      <span className="tnum w-9 shrink-0 text-right text-[13px] font-bold text-ink">
        {slice.percent}%
      </span>
    </div>
  )
}

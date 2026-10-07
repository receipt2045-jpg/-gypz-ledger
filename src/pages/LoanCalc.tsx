import { useState } from 'react'
import AmountInput from '../components/AmountInput'
import Card from '../components/Card'
import CalcShell, { CalcRow } from '../components/CalcShell'
import { LoanForm } from '../components/LoanEditor'

/**
 * 대출 이자 계산기 (2026-10-07). 자산 등록의 대출 정보와 같은 계산을, 대출을 등록하지 않고도 써 본다.
 * 매달 갚는 돈 · 다 갚을 때까지 총액·이자 · 금리가 1%p 오르면.
 */
export default function LoanCalc() {
  const [amount, setAmount] = useState(300_000_000)
  return (
    <CalcShell
      title="대출 이자"
      lead="빌릴 돈과 금리, 기간을 넣으면 매달 갚는 돈과 다 갚을 때까지 내는 이자를 보여줘요."
      cta="이 대출, 괜찮을지 결영이네와 같이"
    >
      <Card>
        <CalcRow label="빌릴 돈 (남은 대출금)">
          <AmountInput value={amount} onChange={setAmount} />
        </CalcRow>
        <div className="mt-3">
          <LoanForm amount={amount} onChange={() => {}} hideLedger />
        </div>
      </Card>
    </CalcShell>
  )
}

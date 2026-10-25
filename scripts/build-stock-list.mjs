// 주식 일지 종목 목록 만들기 (2026-10-25) — public/stock-list.json
//
// 국내: 한국거래소 KIND '상장법인목록' (회사명·종목코드·시장). 시세가 아니라 이름표라 앱에 넣어도 된다.
// ETF와 미국 주식은 KIND에 없어서 자주 사는 것만 아래에 손으로 둔다(코드 없이 이름·티커만).
// 새로 상장한 종목이 안 찾아지면 다시 돌린다:  node scripts/build-stock-list.mjs
import { writeFileSync } from 'node:fs'

const KIND = 'https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13'
const MARKET = { 유가: 'P', 코스닥: 'Q', 코넥스: 'N' }

// 국내 ETF — 종목코드는 비워 둔다(틀린 코드를 보여주느니 이름으로 찾게)
const ETF_KR = [
  'KODEX 200',
  'TIGER 200',
  'KODEX 레버리지',
  'KODEX 인버스',
  'KODEX 200선물인버스2X',
  'TIGER 미국S&P500',
  'TIGER 미국나스닥100',
  'KODEX 미국S&P500',
  'KODEX 미국나스닥100',
  'ACE 미국S&P500',
  'ACE 미국나스닥100',
  'SOL 미국S&P500',
  'RISE 미국S&P500',
  'TIGER 미국배당다우존스',
  'SOL 미국배당다우존스',
  'ACE 미국배당다우존스',
  'TIGER 미국필라델피아반도체나스닥',
  'TIGER 미국테크TOP10 INDXX',
  'KODEX 2차전지산업',
  'TIGER 2차전지테마',
  'KODEX 반도체',
  'TIGER 반도체',
  'KODEX 고배당',
  'TIGER 리츠부동산인프라',
  'KODEX 골드선물(H)',
  'ACE KRX금현물',
  'TIGER KRX금현물',
  'KODEX CD금리액티브(합성)',
  'TIGER CD금리투자KIS(합성)',
  'KODEX 머니마켓액티브',
]

// 미국 — [티커, 한국어 이름]
const US = [
  ['AAPL', '애플'],
  ['MSFT', '마이크로소프트'],
  ['NVDA', '엔비디아'],
  ['TSLA', '테슬라'],
  ['AMZN', '아마존'],
  ['GOOGL', '알파벳 A(구글)'],
  ['GOOG', '알파벳 C(구글)'],
  ['META', '메타'],
  ['NFLX', '넷플릭스'],
  ['AVGO', '브로드컴'],
  ['AMD', 'AMD'],
  ['INTC', '인텔'],
  ['TSM', 'TSMC'],
  ['QCOM', '퀄컴'],
  ['MU', '마이크론'],
  ['ARM', 'ARM'],
  ['SMCI', '슈퍼마이크로컴퓨터'],
  ['PLTR', '팔란티어'],
  ['IONQ', '아이온큐'],
  ['RKLB', '로켓랩'],
  ['COIN', '코인베이스'],
  ['ORCL', '오라클'],
  ['CRM', '세일즈포스'],
  ['ADBE', '어도비'],
  ['UBER', '우버'],
  ['ABNB', '에어비앤비'],
  ['BRK.B', '버크셔해서웨이 B'],
  ['JPM', 'JP모건'],
  ['V', '비자'],
  ['MA', '마스터카드'],
  ['KO', '코카콜라'],
  ['PEP', '펩시코'],
  ['MCD', '맥도날드'],
  ['SBUX', '스타벅스'],
  ['NKE', '나이키'],
  ['DIS', '디즈니'],
  ['COST', '코스트코'],
  ['WMT', '월마트'],
  ['JNJ', '존슨앤드존슨'],
  ['PG', 'P&G'],
  ['LLY', '일라이릴리'],
  ['NVO', '노보노디스크'],
  ['UNH', '유나이티드헬스'],
  ['XOM', '엑슨모빌'],
  ['CVX', '셰브론'],
  ['O', '리얼티인컴'],
  ['T', 'AT&T'],
  ['VZ', '버라이즌'],
  ['BA', '보잉'],
  ['SPY', 'SPDR S&P500 ETF'],
  ['VOO', '뱅가드 S&P500 ETF'],
  ['IVV', '아이셰어즈 S&P500 ETF'],
  ['VTI', '뱅가드 토탈마켓 ETF'],
  ['QQQ', '인베스코 QQQ'],
  ['QQQM', '인베스코 QQQM'],
  ['TQQQ', '프로셰어즈 TQQQ'],
  ['SOXL', '디렉시온 SOXL'],
  ['SOXX', '아이셰어즈 반도체 SOXX'],
  ['SCHD', '슈왑 배당 SCHD'],
  ['JEPI', 'JP모건 JEPI'],
  ['JEPQ', 'JP모건 JEPQ'],
  ['DIA', 'SPDR 다우존스 DIA'],
  ['GLD', 'SPDR 금 GLD'],
  ['TLT', '아이셰어즈 미국채20년 TLT'],
]

const res = await fetch(KIND)
const html = new TextDecoder('euc-kr').decode(await res.arrayBuffer())
const kr = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  .map((m) =>
    [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) =>
      x[1].replace(/<[^>]+>/g, '').trim(),
    ),
  )
  .filter((r) => r.length > 3 && MARKET[r[1]])
  .map((r) => [r[0], r[2], MARKET[r[1]]])

// [이름, 코드, 시장] — 시장: P 코스피 · Q 코스닥 · N 코넥스 · E 국내 ETF · U 미국
const list = [...kr, ...ETF_KR.map((n) => [n, '', 'E']), ...US.map(([t, n]) => [n, t, 'U'])]
writeFileSync(new URL('../public/stock-list.json', import.meta.url), JSON.stringify(list))
console.log(`국내 ${kr.length} · ETF ${ETF_KR.length} · 미국 ${US.length}`)

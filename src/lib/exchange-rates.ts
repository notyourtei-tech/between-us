import type { CurrencyCode } from '../types'

export type FxRates = {
  rates: Record<CurrencyCode, number>
  updatedAt: string
  isLive: boolean
}

const CACHE_KEY = 'between-us:exchange-rates:v1'
const FALLBACK: FxRates = {
  rates: { CNY: 1, JPY: 22.846816, USD: 0.139, BYN: 0.455532 },
  updatedAt: '暂未连接',
  isLive: false,
}

const isFxRates = (value: unknown): value is FxRates => {
  if (!value || typeof value !== 'object') return false
  const maybe = value as FxRates
  return Boolean(maybe.rates?.CNY && maybe.rates?.JPY && maybe.rates?.USD && maybe.rates?.BYN)
}

export const readCachedRates = (): FxRates => {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    return isFxRates(value) ? value : FALLBACK
  } catch {
    return FALLBACK
  }
}

export const fetchRates = async (): Promise<FxRates> => {
  const response = await fetch('https://open.er-api.com/v6/latest/CNY')
  if (!response.ok) throw new Error(`汇率服务返回 ${response.status}`)
  const body = await response.json() as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string }
  const jpy = body.rates?.JPY
  const usd = body.rates?.USD
  const byn = body.rates?.BYN
  if (body.result !== 'success' || !jpy || !usd || !byn) throw new Error('汇率服务暂时不可用')
  const result: FxRates = {
    rates: { CNY: 1, JPY: jpy, USD: usd, BYN: byn },
    updatedAt: body.time_last_update_utc || new Date().toISOString(),
    isLive: true,
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(result))
  return result
}

export const toCny = (amount: number, currency: CurrencyCode, fx: FxRates) => amount / fx.rates[currency]
export const fromCny = (amount: number, currency: CurrencyCode, fx: FxRates) => amount * fx.rates[currency]

export const formatCurrency = (amount: number, currency: CurrencyCode, compact = false) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    currencyDisplay: compact ? 'code' : 'symbol',
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)

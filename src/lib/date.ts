export const isoToday = () => new Date().toISOString().slice(0, 10)

export const daysBetween = (from: string, to = isoToday()) => {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))
}

export const daysUntil = (date: string) => {
  const start = new Date(`${isoToday()}T00:00:00`)
  const end = new Date(`${date}T00:00:00`)
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
}

export const formatDate = (date: string, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(`${date}T00:00:00`))

export const formatShortDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(
    new Date(`${date}T00:00:00`),
  )

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(amount)

export const dateShift = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

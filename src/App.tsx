import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Cloud,
  Heart,
  Infinity as InfinityIcon,
  Leaf,
  LogOut,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react'
import { dataGateway } from './lib/data-gateway'
import { daysBetween, daysUntil, formatDate, formatMoney, formatShortDate, isoToday } from './lib/date'
import { fetchRates, formatCurrency, fromCny, readCachedRates, toCny, type FxRates } from './lib/exchange-rates'
import { hasSupabase, supabase } from './lib/supabase'
import type { AppData, Contributor, CurrencyCode, LoveSpace, MemoryEntry, SavingsEntry, View } from './types'
import './styles.css'

type Account = Pick<User, 'id' | 'email'>
type AuthMode = 'login' | 'register'
type Panel = 'settings' | 'saving' | 'memory' | null

const nav: { id: View; label: string; icon: typeof Heart }[] = [
  { id: 'home', label: '此刻', icon: Heart },
  { id: 'wallet', label: '见面基金', icon: WalletCards },
  { id: 'memory', label: '时光册', icon: InfinityIcon },
]

function App() {
  const [account, setAccount] = useState<Account | null>(null)
  const [data, setData] = useState<AppData | null>(null)
  const [view, setView] = useState<View>('home')
  const [panel, setPanel] = useState<Panel>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [fx, setFx] = useState<FxRates>(() => readCachedRates())
  const [refreshingRates, setRefreshingRates] = useState(false)

  useEffect(() => {
    if (!supabase) {
      const raw = localStorage.getItem('between-us:demo-session')
      if (raw) setAccount(JSON.parse(raw) as Account)
      setLoading(false)
      return
    }

    void supabase.auth.getUser().then(({ data: authData }) => {
      setAccount(authData.user)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(session?.user ?? null)
      setLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!account) {
      setData(null)
      return
    }
    let alive = true
    setLoading(true)
    void dataGateway
      .load(account.id)
      .then((loaded) => {
        if (alive) setData(loaded)
      })
      .catch((error: Error) => setNotice(`读取数据失败：${error.message}`))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [account])

  const refreshRates = async () => {
    setRefreshingRates(true)
    try {
      setFx(await fetchRates())
    } catch (error) {
      setNotice(`暂时无法更新汇率，正在使用最近一次可用数据：${(error as Error).message}`)
    } finally {
      setRefreshingRates(false)
    }
  }

  useEffect(() => {
    if (account) void refreshRates()
  // The account identity is all that should trigger the one-time rate refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  useEffect(() => {
    if (!panel) return

    const scrollY = window.scrollY
    const previousStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    }

    document.body.classList.add('panel-open')
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.classList.remove('panel-open')
      document.body.style.position = previousStyles.position
      document.body.style.top = previousStyles.top
      document.body.style.width = previousStyles.width
      document.body.style.overflow = previousStyles.overflow
      window.scrollTo(0, scrollY)
    }
  }, [panel])

  const updateSpace = async (next: LoveSpace) => {
    if (!account || !data) return
    try {
      const saved = await dataGateway.saveSpace(account.id, next)
      setData({ ...data, space: saved })
      setPanel(null)
      setNotice('已保存。每一段等待都值得被认真对待。')
    } catch (error) {
      setNotice(`保存失败：${(error as Error).message}`)
    }
  }

  const addSaving = async (input: Omit<SavingsEntry, 'id' | 'love_space_id'>) => {
    if (!account || !data) return
    const entry: SavingsEntry = { ...input, id: crypto.randomUUID(), love_space_id: data.space.id }
    try {
      const saved = await dataGateway.addSavings(account.id, entry)
      setData({ ...data, savings: [saved, ...data.savings] })
      setPanel(null)
      setNotice('这一笔已放进见面基金。')
    } catch (error) {
      setNotice(`记录失败：${(error as Error).message}`)
    }
  }

  const addMemory = async (input: Omit<MemoryEntry, 'id' | 'love_space_id'>) => {
    if (!account || !data) return
    const entry: MemoryEntry = { ...input, id: crypto.randomUUID(), love_space_id: data.space.id }
    try {
      const saved = await dataGateway.addMemory(account.id, entry)
      setData({ ...data, memories: [saved, ...data.memories] })
      setPanel(null)
      setNotice('已收进属于你们的时光册。')
    } catch (error) {
      setNotice(`记录失败：${(error as Error).message}`)
    }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    localStorage.removeItem('between-us:demo-session')
    setAccount(null)
    setMenuOpen(false)
  }

  if (loading && account === null) return <LoadingScreen />
  if (!account) return <AuthScreen onLogin={setAccount} />
  if (!data || loading) return <LoadingScreen />

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <aside className="side-rail" aria-label="主导航">
        <div className="brand-mark" aria-label="Between Us">
          <span className="brand-arc" />
          <Heart size={19} fill="currentColor" strokeWidth={1.5} />
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={`rail-link ${view === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => setView(item.id)}
                aria-label={item.label}
                title={item.label}
              >
                <Icon size={19} strokeWidth={1.7} />
              </button>
            )
          })}
        </nav>
        <button className="rail-link rail-bottom" onClick={() => setPanel('settings')} aria-label="设置">
          <Settings2 size={19} strokeWidth={1.7} />
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><Heart size={17} fill="currentColor" /> Between Us</div>
          <div className="topbar-copy">
            <span>{formatDate(isoToday(), { month: 'long', day: 'numeric', weekday: 'long' })}</span>
            <p>把相见之前的每一天，也过成纪念日。</p>
          </div>
          <div className="topbar-actions">
            <div className={`cloud-chip ${dataGateway.isCloud ? 'live' : ''}`} title={dataGateway.isCloud ? '数据正在安全同步' : '演示模式：请配置 Supabase 以启用云端保存'}>
              <Cloud size={14} /> {dataGateway.isCloud ? '已同步' : '演示模式'}
            </div>
            <div className="account-menu-wrap">
              <button className="avatar" onClick={() => setMenuOpen(!menuOpen)} aria-label="账户菜单">
                {(account.email?.[0] ?? 'U').toUpperCase()}
              </button>
              {menuOpen && (
                <div className="account-menu">
                  <small>{account.email}</small>
                  <button onClick={() => setPanel('settings')}><Settings2 size={15} /> 编辑我们</button>
                  <button onClick={() => void signOut()}><LogOut size={15} /> 退出登录</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {!dataGateway.isCloud && (
          <div className="demo-banner">
            <Sparkles size={16} /> 这是本地演示数据。配置 Supabase 后，免费邮箱登录与所有记录都会安全保存到你的账户。
          </div>
        )}
        {notice && (
          <button className="notice" onClick={() => setNotice('')}>
            <Check size={15} /> {notice} <X size={14} />
          </button>
        )}

        {view === 'home' && <HomeView data={data} fx={fx} onEdit={() => setPanel('settings')} onWallet={() => setView('wallet')} />}
        {view === 'wallet' && <WalletView data={data} fx={fx} refreshingRates={refreshingRates} onRefreshRates={() => void refreshRates()} onAdd={() => setPanel('saving')} />}
        {view === 'memory' && <MemoryView data={data} onAdd={() => setPanel('memory')} />}
      </section>

      <nav className="mobile-nav" aria-label="移动端导航">
        {nav.map((item) => {
          const Icon = item.icon
          return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><Icon size={18} /><span>{item.label}</span></button>
        })}
      </nav>

      {panel === 'settings' && <SettingsPanel space={data.space} onClose={() => setPanel(null)} onSave={updateSpace} />}
      {panel === 'saving' && <SavingPanel onClose={() => setPanel(null)} onSave={addSaving} />}
      {panel === 'memory' && <MemoryPanel onClose={() => setPanel(null)} onSave={addMemory} />}
    </main>
  )
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-orbit"><Heart fill="currentColor" /></div><p>正在翻开时光册</p></div>
}

function AuthScreen({ onLogin }: { onLogin: (account: Account) => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (password.length < 6) return setMessage('密码至少需要 6 位。')
    setBusy(true)
    try {
      if (!supabase) {
        const account = { id: `local-${encodeURIComponent(email.toLowerCase())}`, email }
        localStorage.setItem('between-us:demo-session', JSON.stringify(account))
        onLogin(account)
        return
      }
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.user) onLogin(data.user)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user && data.session) onLogin(data.user)
        else setMessage('注册成功。请前往邮箱确认后，再回来登录。')
      }
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-constellation a" /><div className="auth-constellation b" />
      <section className="auth-story">
        <div className="auth-logo"><span><Heart fill="currentColor" size={18} /></span> BETWEEN US</div>
        <p className="eyebrow">A SMALL PLACE FOR TWO</p>
        <h1>让每一次<br /><em>想见你</em>，都有回响。</h1>
        <p className="auth-lede">倒数下一次相见，珍藏已经走过的日子，也把共同的未来一点一点攒起来。</p>
        <div className="date-ribbon"><span>相见不是终点</span><i /><span>是所有等待的答案</span></div>
      </section>
      <section className="auth-card-wrap">
        <div className="auth-card">
          <div className="card-stamp">♡</div>
          <p className="eyebrow">WELCOME HOME</p>
          <h2>{mode === 'login' ? '回来就好。' : '从今天开始记得。'}</h2>
          <p className="auth-sub">{mode === 'login' ? '登录，看看你们离相见又近了多少。' : '免费创建一个只属于你们的时光空间。'}</p>
          <form onSubmit={submit}>
            <label>邮箱<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" required autoComplete="email" /></label>
            <label>密码<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="至少 6 位" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {message && <p className="form-message">{message}</p>}
            <button className="primary-button" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '进入我们的空间' : '免费创建空间'} <ArrowUpRight size={17} /></button>
          </form>
          <button className="text-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>
            {mode === 'login' ? '还没有空间？免费注册' : '已经有账户？直接登录'} <ChevronRight size={15} />
          </button>
          {!hasSupabase && <p className="demo-auth-note">当前为预览模式；接入 Supabase 后即启用真实免费账号和云端存档。</p>}
        </div>
      </section>
    </main>
  )
}

function HomeView({ data, fx, onEdit, onWallet }: { data: AppData; fx: FxRates; onEdit: () => void; onWallet: () => void }) {
  const { space, savings, memories } = data
  const countdown = daysUntil(space.next_meeting_date)
  const knownDays = daysBetween(space.relationship_start_date)
  const metDays = daysBetween(space.first_meeting_date)
  const interval = Math.max(1, daysBetween(space.last_meeting_date, space.next_meeting_date))
  const elapsed = Math.min(interval, daysBetween(space.last_meeting_date))
  const progress = Math.round((elapsed / interval) * 100)
  const saved = savings.reduce((sum, item) => sum + toCny(Number(item.amount), item.currency_code, fx), 0)
  const targetProgress = Math.min(100, Math.round((saved / Math.max(space.savings_target, 1)) * 100))
  const nextMemory = [...memories].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on)).find((item) => item.occurred_on >= isoToday())

  return <div className="page home-page">
    <section className="intro-row">
      <div><p className="eyebrow">OUR LITTLE UNIVERSE</p><h1>{space.owner_name} <span>&amp;</span> {space.partner_name}</h1></div>
      <button className="quiet-button" onClick={onEdit}><Pencil size={15} /> 编辑时间线</button>
    </section>

    <section className="countdown-stage">
      <div className="stage-copy">
        <div className="section-label"><span /> 下一次相见</div>
        <p className="meeting-date">{formatDate(space.next_meeting_date, { month: 'long', day: 'numeric' })}</p>
        <h2>所有的想念<br />都有<strong>期限</strong>。</h2>
        <p className="stage-description">从 {formatShortDate(space.last_meeting_date)} 到 {formatShortDate(space.next_meeting_date)}，这段路我们已经走了 {progress}% 。</p>
        <div className="linear-progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="progress-meta"><span>上次拥抱</span><b>已走 {progress}% · 剩余 {100 - progress}%</b><span>下一次相见</span></div>
      </div>
      <div className="countdown-art" aria-label={`距离相见还有 ${countdown} 天`}>
        <div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><div className="orbit-dot one" /><div className="orbit-dot two" />
        <div className="countdown-number"><small>还有</small><strong>{String(countdown).padStart(2, '0')}</strong><span>天</span></div>
        <div className="countdown-caption">UNTIL WE MEET</div>
      </div>
      <div className="stage-flower">✦</div>
    </section>

    <section className="snapshot-grid">
      <article className="metric-card metric-warm"><span className="metric-icon"><InfinityIcon size={18} /></span><p>在一起已经</p><strong>{knownDays}<em> 天</em></strong><small>从 {formatShortDate(space.relationship_start_date)} 开始</small></article>
      <article className="metric-card"><span className="metric-icon"><Heart size={18} fill="currentColor" /></span><p>第一次见面已过去</p><strong>{metDays}<em> 天</em></strong><small>那些瞬间都还发着光</small></article>
      <button className="metric-card savings-card" onClick={onWallet}><span className="metric-icon"><WalletCards size={18} /></span><p>见面基金</p><strong>{formatMoney(saved)}</strong><div className="mini-bar"><span style={{ width: `${targetProgress}%` }} /></div><small>目标 {formatMoney(space.savings_target)} · {targetProgress}%</small></button>
    </section>

    <MilestoneRail relationshipStart={space.relationship_start_date} knownDays={knownDays} />

    <section className="lower-grid">
      <article className="paper-card promise-card"><div><p className="eyebrow">A NOTE FOR LATER</p><h3>见面那天，<br />第一句话想说什么？</h3></div><div className="promise-line">{nextMemory?.note || '把想念留给一个刚刚好的拥抱。'}<span>— {nextMemory ? formatShortDate(nextMemory.occurred_on) : '未设日期'}</span></div></article>
      <article className="date-card"><div className="calendar-corner"><CalendarDays size={17} /></div><p>下一次纪念</p><h3>{formatDate(space.relationship_start_date, { month: 'numeric', day: 'numeric' })}</h3><span>相识日会在每一年如约而至</span></article>
    </section>
  </div>
}

function MilestoneRail({ relationshipStart, knownDays }: { relationshipStart: string; knownDays: number }) {
  const milestones = [100, 200, 365, 500, 730, 1000]
  const next = milestones.find((days) => days > knownDays) ?? (Math.ceil((knownDays + 1) / 100) * 100)
  const targetDate = new Date(`${relationshipStart}T00:00:00`)
  targetDate.setDate(targetDate.getDate() + next)
  const date = targetDate.toISOString().slice(0, 10)
  return <section className="milestone-rail">
    <div className="milestone-copy"><p className="eyebrow">MILESTONES, NOT DEADLINES</p><h2>下一枚里程碑</h2><p>你们正在走向在一起的第 <strong>{next}</strong> 天。</p></div>
    <div className="milestone-path"><div className="milestone-line"><span style={{ width: `${Math.min(100, Math.round((knownDays / next) * 100))}%` }} /></div><div className="milestone-points">{milestones.slice(0, 4).map((days) => <div className={knownDays >= days ? 'reached' : days === next ? 'next' : ''} key={days}><i>{knownDays >= days ? '✓' : '○'}</i><span>{days} 天</span></div>)}</div></div>
    <div className="milestone-date"><span>预计解锁</span><strong>{formatDate(date, { month: 'numeric', day: 'numeric' })}</strong></div>
  </section>
}

function WalletView({ data, fx, refreshingRates, onRefreshRates, onAdd }: { data: AppData; fx: FxRates; refreshingRates: boolean; onRefreshRates: () => void; onAdd: () => void }) {
  const sorted = useMemo(() => [...data.savings].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)), [data.savings])
  const totals = useMemo(() => data.savings.reduce((result, item) => {
    const inCny = toCny(Number(item.amount), item.currency_code, fx)
    result.together += inCny
    result[item.contributor] += inCny
    result.currencies[item.currency_code] += Number(item.amount)
    return result
  }, { me: 0, partner: 0, together: 0, currencies: { CNY: 0, JPY: 0, BYN: 0 } } as { me: number; partner: number; together: number; currencies: Record<CurrencyCode, number> }), [data.savings, fx])
  const target = data.space.savings_target
  const progress = Math.min(100, Math.round((totals.together / Math.max(target, 1)) * 100))
  const remaining = Math.max(0, target - totals.together)
  const thisMonth = sorted.filter((x) => x.occurred_on.slice(0, 7) === isoToday().slice(0, 7)).reduce((sum, x) => sum + toCny(Number(x.amount), x.currency_code, fx), 0)
  const currencyName: Record<CurrencyCode, string> = { CNY: '人民币', JPY: '日元', BYN: '白俄罗斯卢布' }

  return <div className="page wallet-page">
    <section className="intro-row"><div><p className="eyebrow">FOR THE NEXT HUG</p><h1>见面基金</h1><p className="page-subtitle">各自存下的每一笔，都会在同一个目的地相遇。</p></div><button className="primary-button compact" onClick={onAdd}><Plus size={17} /> 记录一笔</button></section>
    <section className="wallet-hero">
      <div className="wallet-amount"><p>我们共同已经存下</p><h2>{formatCurrency(totals.together, 'CNY')}</h2><span>目标 {formatCurrency(target, 'CNY')} · 以人民币统一计算</span></div>
      <div className="wallet-track"><div className="track-top"><span>共同前进</span><b>{progress}%</b></div><div className="thick-progress"><span style={{ width: `${progress}%` }} /></div><div className="track-bottom"><span>从今天的一点点开始</span><span>还差 {formatCurrency(remaining, 'CNY')}</span></div></div>
      <div className="wallet-emblem"><span>♡</span><small>SAVE<br />TO MEET</small></div>
    </section>
    <section className="contributor-cards" aria-label="双方见面基金累计">
      <article className="contributor-card mine"><span className="person-monogram">我</span><div><p>我的累计</p><strong>{formatCurrency(totals.me, 'CNY')}</strong><small>存入日元 / 人民币的实时折合</small></div></article>
      <article className="contributor-card partner"><span className="person-monogram">TA</span><div><p>{data.space.partner_name}的累计</p><strong>{formatCurrency(totals.partner, 'CNY')}</strong><small>存入白俄罗斯卢布 / 人民币的实时折合</small></div></article>
      <article className="contributor-card together"><span className="person-monogram">♡</span><div><p>我们的共同累计</p><strong>{formatCurrency(totals.together, 'CNY')}</strong><small>相见的距离，正在缩短</small></div></article>
    </section>
    <section className="fx-panel" aria-label="实时汇率换算">
      <div className="fx-panel-title"><div><p className="eyebrow">LIVE EXCHANGE DESK</p><h2>实时汇率换算</h2></div><button className="rate-refresh" onClick={onRefreshRates} disabled={refreshingRates}>{refreshingRates ? '更新中…' : '更新汇率'} <ArrowUpRight size={14} /></button></div>
      <div className="fx-rates"><div><span>1 CNY</span><strong>= {fx.rates.JPY.toFixed(2)} JPY</strong><small>日元</small></div><div><span>1 CNY</span><strong>= {fx.rates.BYN.toFixed(4)} BYN</strong><small>白俄罗斯卢布</small></div><div className="fx-updated"><Cloud size={16} /><span>{fx.isLive ? `更新于 ${fx.updatedAt.replace(' +0000', ' UTC')}` : '显示离线备用汇率'}</span></div></div>
      <div className="currency-breakdown">{(['JPY', 'BYN', 'CNY'] as CurrencyCode[]).map((currency) => { const cnyValue = toCny(totals.currencies[currency], currency, fx); const secondCurrency: CurrencyCode = currency === 'JPY' ? 'BYN' : 'JPY'; return <div key={currency}><span>{currencyName[currency]}已存</span><strong>{formatCurrency(totals.currencies[currency], currency)}</strong><small>≈ {formatCurrency(cnyValue, 'CNY')} · {formatCurrency(fromCny(cnyValue, secondCurrency, fx), secondCurrency)}</small></div> })}</div>
      <p className="fx-attribution">汇率由 ExchangeRate-API 提供，每日更新；仅作见面基金估算，实际兑换以银行/平台为准。</p>
    </section>
    <section className="wallet-insights"><article><CircleDollarSign size={20} /><div><span>本月已存（折合）</span><strong>{formatCurrency(thisMonth, 'CNY')}</strong></div></article><article><Leaf size={20} /><div><span>下一步的小目标</span><strong>{formatCurrency(Math.min(remaining, 500), 'CNY')}</strong></div></article><article><Clock3 size={20} /><div><span>距离见面</span><strong>{daysUntil(data.space.next_meeting_date)} 天</strong></div></article></section>
    <section className="ledger"><div className="ledger-heading"><div><p className="eyebrow">LITTLE DECISIONS</p><h2>不可遗失的攒钱记录</h2></div><span>{sorted.length} 笔 · 只追加</span></div>{sorted.length ? <div className="ledger-list">{sorted.map((item) => <article className="ledger-item" key={item.id}><span className={`entry-icon ${item.contributor}`}><ArrowDownLeft size={17} /></span><div><h3>{item.note || '为相见存下一笔'}</h3><p>{item.contributor === 'me' ? '我存的' : `${data.space.partner_name}存的`} · {formatDate(item.occurred_on)}</p></div><strong>+{formatCurrency(Number(item.amount), item.currency_code)}</strong><small className="entry-converted">≈ {formatCurrency(toCny(Number(item.amount), item.currency_code, fx), 'CNY')}</small></article>)}</div> : <EmptyState icon={<WalletCards size={23} />} text="从第一笔见面基金开始吧。" />}</section>
  </div>
}

function MemoryView({ data, onAdd }: { data: AppData; onAdd: () => void }) {
  const allMemories = [...data.memories].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
  const kindLabel: Record<MemoryEntry['kind'], string> = { meeting: '见面', moment: '瞬间', promise: '约定' }
  return <div className="page memory-page">
    <section className="intro-row"><div><p className="eyebrow">ARCHIVE OF US</p><h1>时光册</h1><p className="page-subtitle">不是为了回头看，是为了知道我们已经走了多远。</p></div><button className="primary-button compact" onClick={onAdd}><Plus size={17} /> 写下一页</button></section>
    <section className="memory-statements"><article><span>01</span><div><p>相识</p><h2>{formatDate(data.space.relationship_start_date)}</h2><small>我们故事的第一行</small></div></article><article><span>02</span><div><p>第一次见面</p><h2>{formatDate(data.space.first_meeting_date)}</h2><small>一切有了真实的温度</small></div></article><article><span>03</span><div><p>下一次相见</p><h2>{formatDate(data.space.next_meeting_date)}</h2><small>正在靠近的答案</small></div></article></section>
    <section className="timeline-section"><div className="ledger-heading"><div><p className="eyebrow">IN CHRONOLOGICAL ORDER</p><h2>大事记时间轴</h2></div><span>{allMemories.length} 页 · 只追加</span></div><p className="append-only-note"><Check size={13} /> 写下的这一页会被保留，不提供删除入口。</p>{allMemories.length ? <div className="timeline">{allMemories.map((item, index) => <article className="timeline-entry" key={item.id}><div className="timeline-pin"><span>{String(index + 1).padStart(2, '0')}</span></div><div className="timeline-date">{formatDate(item.occurred_on, { month: 'short', day: 'numeric', year: 'numeric' })}</div><div className="timeline-content"><small>{kindLabel[item.kind]}</small><h3>{item.title}</h3><p>{item.note}</p></div></article>)}</div> : <EmptyState icon={<Sparkles size={23} />} text="写下一件值得再想起的小事。" />}</section>
  </div>
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="empty-state">{icon}<p>{text}</p></div> }

function SettingsPanel({ space, onClose, onSave }: { space: LoveSpace; onClose: () => void; onSave: (space: LoveSpace) => void }) {
  const [draft, setDraft] = useState(space)
  return <div className="overlay" role="dialog" aria-modal="true" aria-label="编辑时间线"><section className="sheet settings-sheet"><header><div><p className="eyebrow">MAKE IT YOURS</p><h2>编辑你们的时间线</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></header><form onSubmit={(e) => { e.preventDefault(); onSave({ ...draft, savings_target: Number(draft.savings_target) || 0 }) }}><div className="form-grid"><label>你的名字<input value={draft.owner_name} onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })} required /></label><label>TA 的名字<input value={draft.partner_name} onChange={(e) => setDraft({ ...draft, partner_name: e.target.value })} required /></label></div><div className="date-fields"><label>相识的日子<input type="date" value={draft.relationship_start_date} onChange={(e) => setDraft({ ...draft, relationship_start_date: e.target.value })} required /></label><label>第一次见面<input type="date" value={draft.first_meeting_date} onChange={(e) => setDraft({ ...draft, first_meeting_date: e.target.value })} required /></label><label>上一次见面<input type="date" value={draft.last_meeting_date} onChange={(e) => setDraft({ ...draft, last_meeting_date: e.target.value })} required /></label><label>下一次见面<input type="date" value={draft.next_meeting_date} onChange={(e) => setDraft({ ...draft, next_meeting_date: e.target.value })} required /></label></div><label>见面基金目标（元）<input type="number" min="0" value={draft.savings_target} onChange={(e) => setDraft({ ...draft, savings_target: Number(e.target.value) })} /></label><button className="primary-button" type="submit">保存这段时间 <Check size={17} /></button></form></section></div>
}

function SavingPanel({ onClose, onSave }: { onClose: () => void; onSave: (entry: Omit<SavingsEntry, 'id' | 'love_space_id'>) => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(isoToday())
  const [currency, setCurrency] = useState<CurrencyCode>('JPY')
  const [contributor, setContributor] = useState<Contributor>('me')
  const unit: Record<CurrencyCode, string> = { CNY: 'CNY / 人民币', JPY: 'JPY / 日元', BYN: 'BYN / 白俄罗斯卢布' }
  return <div className="overlay" role="dialog" aria-modal="true" aria-label="记录见面基金"><section className="sheet small-sheet"><header><div><p className="eyebrow">ONE STEP CLOSER</p><h2>存下一点相见</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></header><form onSubmit={(e) => { e.preventDefault(); onSave({ amount: Number(amount), currency_code: currency, contributor, note, occurred_on: date }) }}><div className="form-grid"><label>这笔是谁存的<select value={contributor} onChange={(e) => setContributor(e.target.value as Contributor)}><option value="me">我存的</option><option value="partner">TA 存的</option></select></label><label>存入币种<select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>{(['JPY', 'BYN', 'CNY'] as CurrencyCode[]).map((code) => <option value={code} key={code}>{unit[code]}</option>)}</select></label></div><label>金额（{unit[currency]}）<input className="amount-input" type="number" min="0.01" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></label><label>这一笔来自<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：本周的零花钱" /></label><label>日期<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><p className="append-only-note"><Check size={13} /> 保存后会成为不可删除的共同记录。</p><button className="primary-button" type="submit">放进见面基金 <ArrowDownLeft size={17} /></button></form></section></div>
}

function MemoryPanel({ onClose, onSave }: { onClose: () => void; onSave: (entry: Omit<MemoryEntry, 'id' | 'love_space_id'>) => void }) {
  const [kind, setKind] = useState<MemoryEntry['kind']>('moment')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(isoToday())
  return <div className="overlay" role="dialog" aria-modal="true" aria-label="写下时光"><section className="sheet small-sheet"><header><div><p className="eyebrow">KEEP THIS ONE</p><h2>写下一页</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></header><form onSubmit={(e) => { e.preventDefault(); onSave({ kind, title, note, occurred_on: date }) }}><label>它是什么<select value={kind} onChange={(e) => setKind(e.target.value as MemoryEntry['kind'])}><option value="moment">一个瞬间</option><option value="meeting">一次见面</option><option value="promise">一个约定</option></select></label><label>这一页的标题<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：雨天一起走路" required autoFocus /></label><label>想留下的话<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="写下当时的感觉，给以后的你们看。" rows={3} /></label><label>日期<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><button className="primary-button" type="submit">收进时光册 <Sparkles size={17} /></button></form></section></div>
}

export default App

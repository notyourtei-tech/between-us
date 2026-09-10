const express = require('express')
const cors = require('cors')

const app = express()
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS'))
  },
}))
app.use(express.json({ limit: '32kb' }))

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'between-us-api', time: new Date().toISOString() })
})

app.get('/api/app-info', (_req, res) => {
  res.status(200).json({
    name: 'Between Us',
    features: ['countdown', 'shared-savings', 'memories'],
    storage: 'Supabase Auth + PostgreSQL',
  })
})

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

const port = Number(process.env.PORT || 10000)
app.listen(port, '0.0.0.0', () => console.log(`Between Us API listening on ${port}`))

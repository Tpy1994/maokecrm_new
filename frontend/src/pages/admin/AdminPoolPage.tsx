import { useEffect, useMemo, useState } from 'react'
import { Input, Table, Tag, message } from 'antd'
import { api } from '../../api/client'

type PoolStatus = 'pending' | 'active' | 'ended'

interface PoolTag {
  id: string
  name: string
  color: string
}

interface PoolItem {
  pool_id: string | null
  customer_id: string
  customer_name: string
  customer_info: string
  tags: PoolTag[]
  sales_name: string | null
  entered_days: number
  claim_status: string
  pool_entered_at: string
}

interface PoolResp {
  summary: {
    pending: number
    active: number
    ended: number
  }
  items: PoolItem[]
}

const statusMeta: Record<PoolStatus, { label: string; statusText: string }> = {
  pending: { label: '未认领', statusText: '未认领' },
  active: { label: '进行中', statusText: '进行中' },
  ended: { label: '已结束', statusText: '已结束' },
}

function enteredText(days: number) {
  if (days <= 0) return '今天'
  return `${days} 天前`
}

export default function AdminPoolPage() {
  const [status, setStatus] = useState<PoolStatus>('pending')
  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState<PoolItem[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ pending: 0, active: 0, ended: 0 })

  const fetchPool = async (nextStatus = status, nextKeyword = keyword) => {
    setLoading(true)
    try {
      const q: string[] = [`status=${nextStatus}`]
      if (nextKeyword.trim()) q.push(`keyword=${encodeURIComponent(nextKeyword.trim())}`)
      const data = await api.get<PoolResp>(`/admin/pool?${q.join('&')}`)
      setSummary(data.summary)
      setRows(data.items)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载咨询池失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPool('pending', '')
  }, [])

  const columns = useMemo(
    () => [
      {
        title: '客户',
        key: 'customer',
        width: 230,
        render: (_: unknown, r: PoolItem) => (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1f1f1f', lineHeight: 1.3 }}>{r.customer_name}</div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 2 }}>{r.customer_info || '-'}</div>
          </div>
        ),
      },
      {
        title: '标签',
        key: 'tags',
        width: 320,
        render: (_: unknown, r: PoolItem) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {r.tags.length ? r.tags.map((t) => <Tag key={t.id} color={t.color}>{t.name}</Tag>) : <span style={{ color: '#bfbfbf' }}>-</span>}
          </div>
        ),
      },
      {
        title: '来源销售',
        dataIndex: 'sales_name',
        width: 130,
        render: (v: string | null) => <span style={{ fontWeight: 600 }}>{v || '-'}</span>,
      },
      {
        title: '入池时间 ↑',
        dataIndex: 'entered_days',
        width: 130,
        render: (v: number) => <span style={{ color: '#7f1d1d', fontWeight: 600 }}>{enteredText(v)}</span>,
      },
      {
        title: '认领状态',
        dataIndex: 'claim_status',
        width: 120,
        render: (v: string) => {
          const isPending = v === '未认领'
          const isActive = v === '进行中'
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: isPending ? '#fdecec' : isActive ? '#eaf2ff' : '#f2f2ed',
                color: isPending ? '#a61d24' : isActive ? '#1d4ed8' : '#666',
              }}
            >
              {v}
            </span>
          )
        },
      },
    ],
    []
  )

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div>
          <h2>咨询池</h2>
          <p className="page-subtitle">
            未认领 {summary.pending} · 进行中 {summary.active} · 已结束 {summary.ended}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {(Object.keys(statusMeta) as PoolStatus[]).map((s) => {
            const active = s === status
            const count = s === 'pending' ? summary.pending : s === 'active' ? summary.active : summary.ended
            return (
              <button
                key={s}
                onClick={() => {
                  setStatus(s)
                  fetchPool(s, keyword)
                }}
                style={{
                  border: '1px solid #d9d9d9',
                  borderRadius: 10,
                  padding: '7px 16px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  background: active ? '#f4ead8' : '#fff',
                  color: '#333',
                }}
              >
                {statusMeta[s].label} {count}
              </button>
            )
          })}
        </div>

        <Input.Search
          placeholder="搜索客户"
          allowClear
          style={{ width: 340 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => fetchPool(status, v)}
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          rowKey="pool_id"
          dataSource={rows}
          columns={columns}
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无数据' }}
        />
      </div>
    </div>
  )
}

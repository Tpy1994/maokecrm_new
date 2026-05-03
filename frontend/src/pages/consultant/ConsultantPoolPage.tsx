import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Select, Table, Tag, message } from 'antd'
import { api } from '../../api/client'

interface Badge { consultant_id: string; consultant_name: string; is_me: boolean }
interface CTag { id: string; name: string; color: string }
interface CProduct { product_id: string; product_name: string; is_refunded: boolean }
interface PoolItem {
  pool_id: string
  customer_id: string
  customer_name: string
  phone: string
  wechat_name: string | null
  source_channel: string | null
  deal_product: string | null
  deal_amount: number | null
  pool_entered_at: string
  tags: CTag[]
  products: CProduct[]
  sales_name: string | null
  consultants: Badge[]
  service_status: 'unclaimed' | 'claimed_by_others' | 'joined_by_me'
  consultant_count: number
  can_claim: boolean
  can_join: boolean
}

const actionBtnBase = {
  height: 27,
  minWidth: 64,
  borderRadius: 9,
  fontWeight: 600,
} as const

export default function ConsultantPoolPage() {
  const [rows, setRows] = useState<PoolItem[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<'all' | 'unclaimed' | 'joined_by_me'>('all')

  const totalCount = rows.length
  const unclaimedCount = rows.filter((r) => r.service_status === 'unclaimed').length

  const filteredRows = rows.filter((r) => {
    if (filter === 'unclaimed') return r.service_status === 'unclaimed'
    if (filter === 'joined_by_me') return r.service_status === 'joined_by_me'
    return true
  })

  const fetchRows = async (k = keyword) => {
    setLoading(true)
    try {
      const q: string[] = []
      if (k.trim()) q.push(`keyword=${encodeURIComponent(k.trim())}`)
      const query = q.length ? `?${q.join('&')}` : ''
      setRows(await api.get<PoolItem[]>(`/consultant/pool${query}`))
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载咨询池失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows('') }, [])

  const claim = async (customerId: string) => {
    await api.post(`/consultant/pool/${customerId}/claim`)
    message.success('认领成功')
    fetchRows()
  }

  const joinService = async (customerId: string) => {
    await api.post(`/consultant/pool/${customerId}/join`)
    message.success('加入服务成功')
    fetchRows()
  }

  const formatEntered = (value: string) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    const today = new Date()
    const diff = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
    if (diff <= 0) return '今天'
    return `${diff} 天前`
  }

  const columns = useMemo(
    () => [
      {
        title: '客户',
        key: 'customer',
        width: 200,
        render: (_: unknown, r: PoolItem) => (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1f1f1f', lineHeight: 1.3 }}>{r.customer_name}</div>
            <div style={{ color: '#7d7d7d', fontSize: 12, marginTop: 2 }}>{r.source_channel || r.phone || '-'}</div>
          </div>
        ),
      },
      {
        title: '标签',
        key: 'tags',
        width: 180,
        render: (_: unknown, r: PoolItem) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {r.tags.map((t) => <Tag key={t.id} color={t.color}>{t.name}</Tag>)}
          </div>
        ),
      },
      {
        title: '已购课程',
        key: 'products',
        width: 170,
        render: (_: unknown, r: PoolItem) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {r.products.map((p) => (
              <Tag
                key={p.product_id}
                style={{
                  marginRight: 0,
                  display: 'inline-block',
                  width: 'fit-content',
                  textDecoration: p.is_refunded ? 'line-through' : 'none',
                  color: p.is_refunded ? '#b42318' : '#156f52',
                  borderColor: 'transparent',
                  background: p.is_refunded ? '#fdecec' : '#dff3eb',
                }}
              >
                {p.product_name}
              </Tag>
            ))}
          </div>
        ),
      },
      {
        title: '来源销售',
        dataIndex: 'sales_name',
        width: 100,
        render: (v: string | null) => <span style={{ fontWeight: 600 }}>{v || '-'}</span>,
      },
      {
        title: '服务咨询师',
        key: 'consultants',
        width: 190,
        render: (_: unknown, r: PoolItem) => {
          if (!r.consultants.length) {
            return (
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 8, background: '#fdf0f0', color: '#a61d24', fontSize: 12, fontWeight: 600 }}>
                待认领
              </span>
            )
          }
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {r.consultants.map((c) => (
                <span
                  key={c.consultant_id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 10px',
                    borderRadius: 999,
                    background: c.is_me ? '#d8f2e7' : '#eef6f2',
                    color: '#156f52',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {c.is_me ? `周 · ${c.consultant_name}` : c.consultant_name}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        title: '入池时间',
        dataIndex: 'pool_entered_at',
        width: 120,
        render: (v: string) => <span style={{ color: '#7f1d1d', fontWeight: 600 }}>{formatEntered(v)}</span>,
      },
      {
        title: '操作',
        key: 'actions',
        width: 110,
        render: (_: unknown, r: PoolItem) => {
          if (r.can_claim) {
            return (
              <Button
                type="primary"
                style={{ ...actionBtnBase, background: '#5fbf9f', borderColor: '#5fbf9f', padding: '0 8px', fontSize: 11 }}
                onClick={() => claim(r.customer_id)}
              >
                认领
              </Button>
            )
          }
          if (r.can_join) {
            return (
              <Button
                style={{ ...actionBtnBase, borderColor: '#d4d4d4', color: '#3f3f3f', background: '#fff', padding: '0 8px', fontSize: 11 }}
                onClick={() => joinService(r.customer_id)}
              >
                加入服务
              </Button>
            )
          }
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...actionBtnBase,
                border: '1px solid #e5e5e5',
                background: '#f7f7f5',
                color: '#9a9a9a',
                fontSize: 11,
              }}
            >
              服务中
            </span>
          )
        },
      },
    ],
    []
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>咨询池</h2>
          <p className="page-subtitle">所有咨询客户 · 共 {totalCount} 个 · 待认领 {unclaimedCount} 个</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Select
            style={{ width: 170 }}
            value={filter}
            onChange={(v) => setFilter(v)}
            options={[
              { value: 'all', label: '排序：待认领优先' },
              { value: 'unclaimed', label: '仅待认领' },
              { value: 'joined_by_me', label: '我服务中' },
            ]}
          />
          <Input.Search
            placeholder="搜索客户"
            allowClear
            style={{ width: 260 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => fetchRows(v)}
          />
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 12, overflow: 'hidden' }}>
        <Table
          rowKey="customer_id"
          dataSource={filteredRows}
          columns={columns}
          loading={loading}
          pagination={false}
          size="small"
          onRow={(record) => ({ style: { background: record.service_status === 'unclaimed' ? '#fff8f8' : '#fff' } })}
        />
      </div>
    </div>
  )
}

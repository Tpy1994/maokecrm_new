import { useEffect, useState } from 'react'
import { Button, Input, Select, message, Table, Tag } from 'antd'
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
      if (k) q.push(`keyword=${encodeURIComponent(k)}`)
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

  const formatTime = (value: string) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    const yy = d.getFullYear()
    const mm = `${d.getMonth() + 1}`.padStart(2, '0')
    const dd = `${d.getDate()}`.padStart(2, '0')
    const hh = `${d.getHours()}`.padStart(2, '0')
    const mi = `${d.getMinutes()}`.padStart(2, '0')
    return `${yy}-${mm}-${dd} ${hh}:${mi}`
  }

  const columns = [
    {
      title: '客户',
      key: 'customer',
      width: 190,
      render: (_: unknown, r: PoolItem) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.customer_name}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{r.phone || '-'}</div>
        </div>
      ),
    },
    {
      title: '标签',
      key: 'tags',
      width: 170,
      render: (_: unknown, r: PoolItem) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{r.tags.map(t => <Tag key={t.id} color={t.color}>{t.name}</Tag>)}</div>,
    },
    {
      title: '已购课程',
      key: 'products',
      width: 170,
      render: (_: unknown, r: PoolItem) => <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{r.products.map(p => <Tag key={p.product_id} style={{ textDecoration: p.is_refunded ? 'line-through' : 'none', color: p.is_refunded ? '#cf1322' : '#135200', borderColor: 'transparent', background: p.is_refunded ? '#fff1f0' : '#e6fffb' }}>{p.product_name}</Tag>)}</div>,
    },
    { title: '来源销售', dataIndex: 'sales_name', width: 100, render: (v: string | null) => v || '—' },
    {
      title: '服务咨询师',
      key: 'consultants',
      width: 180,
      render: (_: unknown, r: PoolItem) => {
        if (!r.consultants.length) return <Tag color="red">待认领</Tag>
        return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{r.consultants.map(c => <Tag key={c.consultant_id} color="green">{c.is_me ? `周 · ${c.consultant_name}(我)` : c.consultant_name}</Tag>)}</div>
      },
    },
    { title: '入池时间', dataIndex: 'pool_entered_at', width: 160, render: (v: string) => <span>{formatTime(v)}</span> },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_: unknown, r: PoolItem) => {
        if (r.can_claim) {
          return <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => claim(r.customer_id)}>认领</Button>
        }
        if (r.can_join) {
          return <Button onClick={() => joinService(r.customer_id)}>加入服务</Button>
        }
        return <span style={{ color: '#bfbfbf' }}>服务中</span>
      },
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>咨询池</h2>
          <p className="page-subtitle">
            所有咨询客户的全局总览（共 {totalCount} 个用户，待认领 {unclaimedCount} 个）
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Select
            style={{ width: 140 }}
            value={filter}
            onChange={(v) => setFilter(v)}
            options={[
              { value: 'all', label: '全部' },
              { value: 'unclaimed', label: '待认领' },
              { value: 'joined_by_me', label: '我服务中' },
            ]}
          />
          <Input.Search placeholder="搜索客户" style={{ width: 280 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={(v) => fetchRows(v)} />
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          rowKey="customer_id"
          dataSource={filteredRows}
          columns={columns}
          loading={loading}
          pagination={false}
          onRow={(record) => ({ style: { background: record.service_status === 'unclaimed' ? '#fff1f0' : '#fff' } })}
        />
      </div>
    </div>
  )
}


import { useEffect, useMemo, useState } from 'react'
import { Button, Input, message, Table, Tag } from 'antd'
import { api } from '../../api/client'

interface Badge { consultant_id: string; consultant_name: string; is_me: boolean }
interface CTag { id: string; name: string; color: string }
interface CProduct { product_id: string; product_name: string; is_refunded: boolean }
interface PoolItem {
  customer_id: string
  customer_name: string
  customer_info: string
  tags: CTag[]
  products: CProduct[]
  sales_name: string | null
  consultants: Badge[]
  pool_status: 'pending' | 'serving' | 'ended'
  pool_age_label: string
  pool_sort_time: string
}

export default function ConsultantPoolPage() {
  const [rows, setRows] = useState<PoolItem[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'all' | 'pending' | 'serving' | 'ended'>('all')

  const fetchRows = async (k = keyword, s = status) => {
    setLoading(true)
    try {
      const q: string[] = []
      if (k) q.push(`keyword=${encodeURIComponent(k)}`)
      if (s !== 'all') q.push(`status=${s}`)
      const query = q.length ? `?${q.join('&')}` : ''
      setRows(await api.get<PoolItem[]>(`/consultant/pool${query}`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows('', 'all') }, [])

  const counts = useMemo(() => ({
    pending: rows.filter(r => r.pool_status === 'pending').length,
    serving: rows.filter(r => r.pool_status === 'serving').length,
    ended: rows.filter(r => r.pool_status === 'ended').length,
  }), [rows])

  const claim = async (customerId: string) => {
    await api.post(`/consultant/pool/${customerId}/claim`)
    message.success('认领成功')
    fetchRows()
  }

  const columns = [
    {
      title: '客户',
      key: 'customer',
      width: 190,
      render: (_: unknown, r: PoolItem) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.customer_name}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{r.customer_info || '-'}</div>
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
    { title: '入池时间', dataIndex: 'pool_age_label', width: 100, render: (v: string, r: PoolItem) => <span style={{ color: r.pool_status === 'pending' ? '#a8071a' : '#262626', fontWeight: r.pool_status === 'pending' ? 700 : 500 }}>{v}</span> },
    {
      title: '操作',
      key: 'actions',
      width: 88,
      render: (_: unknown, r: PoolItem) => r.pool_status === 'pending' ? <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => claim(r.customer_id)}>认领</Button> : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>咨询池</h2>
          <p className="page-subtitle">所有咨询客户的全局总览</p>
        </div>
        <Input.Search placeholder="搜索客户" style={{ width: 280 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={(v) => fetchRows(v, status)} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          { label: `待认领 ${counts.pending}`, value: 'pending' },
          { label: `服务中 ${counts.serving}`, value: 'serving' },
          { label: `已结束 ${counts.ended}`, value: 'ended' },
          { label: '全部', value: 'all' },
        ].map((item) => {
          const active = status === item.value
          return (
            <button
              key={item.value}
              onClick={() => { const nv = item.value as 'all' | 'pending' | 'serving' | 'ended'; setStatus(nv); fetchRows(keyword, nv) }}
              style={{
                border: '1px solid #d9d9d9',
                background: active ? '#d1fae5' : '#fff',
                color: '#262626',
                borderRadius: 9,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          rowKey="customer_id"
          dataSource={rows}
          columns={columns}
          loading={loading}
          pagination={false}
          onRow={(record) => ({ style: { background: record.pool_status === 'pending' ? '#fff1f0' : '#fff' } })}
        />
      </div>
    </div>
  )
}

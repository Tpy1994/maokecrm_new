import { useEffect, useState } from 'react'
import { Input, Select, Table, Tag } from 'antd'
import { api } from '../../api/client'

interface AuditLogItem {
  id: string
  created_at: string
  action: string
  amount_delta: number | null
  note: string | null
  resource_type: string
  operator_name: string | null
  customer_name: string | null
}

interface AuditLogList {
  total: number
  items: AuditLogItem[]
}

const y2f = (yuan: number) => `¥${Number(yuan || 0).toLocaleString()}`
const actionLabel: Record<string, string> = {
  admin_writeoff_course_created: '新增管理员销课',
  admin_writeoff_course_refunded: '管理员销课退款',
  admin_writeoff_course_refund_reverted: '管理员销课撤销退款',
  gift_request_approved: '赠送学费通过',
  gift_request_rejected: '赠送学费驳回',
}

export default function AdminAuditLogsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AuditLogList>({ total: 0, items: [] })
  const [action, setAction] = useState('all')
  const [days, setDays] = useState(30)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = async (nextPage = page, nextKeyword = keyword) => {
    setLoading(true)
    try {
      const q: string[] = [`page=${nextPage}`, 'page_size=20', `days=${days}`]
      if (action !== 'all') q.push(`action=${encodeURIComponent(action)}`)
      if (nextKeyword.trim()) q.push(`keyword=${encodeURIComponent(nextKeyword.trim())}`)
      const res = await api.get<AuditLogList>(`/admin/audit-logs?${q.join('&')}`)
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchLogs(1) }, [action, days])

  return (
    <div>
      <div className='page-header'>
        <div>
          <h2>操作日志</h2>
          <p className='page-subtitle'>展示销课与赠送学费相关审计行为，支持筛选与分页。</p>
        </div>
      </div>

      <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '220px 120px 1fr', gap: 8 }}>
        <Select
          value={action}
          onChange={(v) => { setAction(v); setPage(1) }}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'admin_writeoff_course_created', label: '新增管理员销课' },
            { value: 'admin_writeoff_course_refunded', label: '管理员销课退款' },
            { value: 'admin_writeoff_course_refund_reverted', label: '管理员销课撤销退款' },
            { value: 'gift_request_approved', label: '赠送学费通过' },
            { value: 'gift_request_rejected', label: '赠送学费驳回' },
          ]}
        />
        <Select
          value={days}
          onChange={(v) => { setDays(v); setPage(1) }}
          options={[
            { value: 7, label: '近7天' },
            { value: 30, label: '近30天' },
          ]}
        />
        <Input.Search
          value={keyword}
          allowClear
          placeholder='搜索动作/操作人/备注'
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => { setPage(1); void fetchLogs(1, v) }}
        />
      </div>

      <Table
        rowKey='id'
        loading={loading}
        dataSource={data.items}
        size='small'
        scroll={{ x: 980 }}
        pagination={{
          current: page,
          total: data.total,
          pageSize: 20,
          onChange: (p) => { setPage(p); void fetchLogs(p) },
        }}
        columns={[
          { title: '动作', dataIndex: 'action', width: 170, render: (v: string) => <Tag color='blue'>{actionLabel[v] || v}</Tag> },
          { title: '操作人', dataIndex: 'operator_name', width: 130, render: (v: string | null) => v || '-' },
          {
            title: '金额变动',
            dataIndex: 'amount_delta',
            width: 130,
            render: (v: number | null) => v === null ? '-' : (
              <span style={{ color: v >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                {v >= 0 ? '+' : ''}{y2f(v)}
              </span>
            ),
          },
          { title: '客户', dataIndex: 'customer_name', width: 140, render: (v: string | null) => v || '-' },
          { title: '资源类型', dataIndex: 'resource_type', width: 150 },
          { title: '时间', dataIndex: 'created_at', width: 170, render: (v: string) => new Date(v).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
          { title: '备注', dataIndex: 'note', width: 260, render: (v: string | null) => v || '' },
        ]}
      />
    </div>
  )
}

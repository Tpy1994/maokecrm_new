import { useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../api/client'

interface Badge { consultant_id: string; consultant_name: string; is_me: boolean }
interface CTag { id: string; name: string; color: string }
interface CProduct { product_id: string; product_name: string; is_refunded: boolean }
interface TagOption { id: string; name: string; color: string; category_name: string }
interface RowItem {
  relation_id: string
  customer_id: string
  customer_name: string
  customer_info: string
  tags: CTag[]
  products: CProduct[]
  note: string | null
  next_consultation: string | null
  next_consultation_status: string
  next_consultation_label: string
  period_label: string
  period_status: string
  consultation_count: number
  is_refunded_customer: boolean
  row_tone: string
  collaborators: Badge[]
}
interface LogItem {
  id: string
  customer_id: string
  consultant_id: string
  consultant_name: string
  is_me: boolean
  log_date: string
  duration: number
  summary: string | null
  content: string | null
  created_at: string
}

const toneBg: Record<string, string> = {
  danger: '#fff3f3',
  info: '#eef3f9',
  warn: '#fffbe6',
  muted: '#f7f7f7',
  normal: '#fff',
}

export default function ConsultantCustomersPage() {
  const [rows, setRows] = useState<RowItem[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [editing, setEditing] = useState<RowItem | null>(null)
  const [logTarget, setLogTarget] = useState<RowItem | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [editingLog, setEditingLog] = useState<LogItem | null>(null)
  const [tagTarget, setTagTarget] = useState<RowItem | null>(null)
  const [tagOptions, setTagOptions] = useState<TagOption[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [logForm] = Form.useForm()

  const fetchRows = async (k = keyword) => {
    setLoading(true)
    try {
      const query = k ? `?keyword=${encodeURIComponent(k)}` : ''
      setRows(await api.get<RowItem[]>(`/consultant/customers${query}`))
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async (customerId: string) => {
    setLogsLoading(true)
    try {
      setLogs(await api.get<LogItem[]>(`/consultant/customers/${customerId}/logs`))
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchTags = async () => {
    setTagOptions(await api.get<TagOption[]>('/consultant/tags'))
  }

  useEffect(() => { fetchRows('') }, [])

  const filtered = useMemo(() => rows, [rows])

  const saveCustomer = async () => {
    if (!editing) return
    const v = await form.validateFields()
    await api.put(`/consultant/customers/${editing.customer_id}`, {
      note: v.note ?? null,
      start_date: v.start_date ? dayjs(v.start_date).format('YYYY-MM-DD') : null,
      end_date: v.end_date ? dayjs(v.end_date).format('YYYY-MM-DD') : null,
      next_consultation: v.next_consultation ? dayjs(v.next_consultation).toISOString() : null,
    })
    message.success('已更新')
    setEditing(null)
    fetchRows()
  }

  const submitLog = async () => {
    if (!logTarget) return
    const v = await logForm.validateFields()
    const payload = {
      log_date: dayjs(v.log_date).format('YYYY-MM-DD'),
      duration: v.duration,
      summary: v.summary ?? null,
      content: v.content ?? null,
    }
    if (editingLog) await api.put(`/consultant/logs/${editingLog.id}`, payload)
    else await api.post(`/consultant/customers/${logTarget.customer_id}/logs`, payload)
    message.success('日志已保存')
    setEditingLog(null)
    logForm.resetFields()
    fetchLogs(logTarget.customer_id)
    fetchRows()
  }

  const returnToPool = async (customerId: string) => {
    await api.post(`/consultant/customers/${customerId}/return-to-pool`)
    message.success('已退回咨询池')
    fetchRows()
  }

  const addTag = async () => {
    if (!tagTarget || !selectedTag) return
    await api.post(`/consultant/customers/${tagTarget.customer_id}/tags`, { tag_id: selectedTag })
    message.success('标签已添加')
    setTagTarget(null)
    setSelectedTag(null)
    fetchRows()
  }

  const removeTag = async (customerId: string, tagId: string) => {
    await api.delete(`/consultant/customers/${customerId}/tags/${tagId}`)
    fetchRows()
  }

  const columns = [
    {
      title: '客户',
      key: 'customer',
      width: 180,
      render: (_: unknown, r: RowItem) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.customer_name}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 2 }}>{r.customer_info || '-'}</div>
        </div>
      ),
    },
    {
      title: '标签',
      key: 'tags',
      width: 220,
      render: (_: unknown, r: RowItem) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {r.tags.map((t) => (
            <Tag key={t.id} color={t.color} style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>
              {t.name}
              <button onClick={() => removeTag(r.customer_id, t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, marginLeft: 4, fontSize: 11 }}>×</button>
            </Tag>
          ))}
          <button
            onClick={() => { setTagTarget(r); setSelectedTag(null); fetchTags() }}
            style={{ border: '1px dashed #E8E8E3', background: 'none', cursor: 'pointer', color: '#8E8E8E', fontSize: 10, padding: '1px 6px', borderRadius: 3 }}
          >
            +
          </button>
        </div>
      ),
    },
    {
      title: '已购课程',
      key: 'products',
      width: 170,
      render: (_: unknown, r: RowItem) => <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{r.products.map(p => <Tag key={p.product_id} style={{ textDecoration: p.is_refunded ? 'line-through' : 'none', color: p.is_refunded ? '#cf1322' : '#135200', borderColor: 'transparent', background: p.is_refunded ? '#fff1f0' : '#e6fffb' }}>{p.product_name}</Tag>)}</div>,
    },
    { title: '备注', dataIndex: 'note', width: 160, render: (v: string | null) => v || '—' },
    {
      title: '下次咨询',
      dataIndex: 'next_consultation_label',
      width: 120,
      render: (v: string, r: RowItem) => {
        const lines = v.split('\n')
        const color = r.next_consultation_status === 'overdue' ? '#a8071a' : '#003a8c'
        return <div><div style={{ color, fontWeight: 700 }}>{lines[0]}</div><div style={{ color, fontSize: 12 }}>{lines[1] || ''}</div></div>
      },
    },
    {
      title: '咨询周期',
      dataIndex: 'period_label',
      width: 120,
      render: (v: string, r: RowItem) => {
        const lines = v.split('\n')
        const color = r.period_status === 'near_expiry' ? '#d46b08' : r.period_status === 'refunded' ? '#a8071a' : '#08979c'
        return <div><div style={{ fontWeight: 700 }}>{lines[0]}</div><div style={{ color, fontSize: 12 }}>{lines[1] || ''}</div></div>
      },
    },
    {
      title: '咨询次数',
      dataIndex: 'consultation_count',
      width: 90,
      render: (v: number, r: RowItem) => <Button size="small" onClick={() => { setLogTarget(r); fetchLogs(r.customer_id) }}>{v} ▾</Button>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_: unknown, r: RowItem) => r.is_refunded_customer ? (
        <Popconfirm title="确认退回咨询池？" onConfirm={() => returnToPool(r.customer_id)}>
          <Button type="default" style={{ borderColor: '#faad14', color: '#ad6800' }}>退回咨询池</Button>
        </Popconfirm>
      ) : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>我的咨询客户</h2>
          <p className="page-subtitle">按下次咨询时间排序</p>
        </div>
        <Input.Search placeholder="搜索姓名/标签" style={{ width: 280 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={(v) => fetchRows(v)} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          rowKey="relation_id"
          dataSource={filtered}
          columns={columns}
          loading={loading}
          pagination={false}
          size="middle"
          onRow={(record) => ({ style: { background: toneBg[record.row_tone] || '#fff' }, onDoubleClick: () => { setEditing(record); form.setFieldsValue({ note: record.note ?? '' }) } })}
        />
      </div>

      <Modal title="添加咨询师标签" open={!!tagTarget} onOk={addTag} onCancel={() => { setTagTarget(null); setSelectedTag(null) }}>
        <Select value={selectedTag} onChange={setSelectedTag} style={{ width: '100%' }} placeholder="搜索并选择标签" showSearch optionFilterProp="label">
          {tagOptions.map((t) => (
            <Select.Option key={t.id} value={t.id} label={t.name}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: t.color, marginRight: 6 }} />
              {t.name}
              <span style={{ color: '#B8B8B8', fontSize: 10, marginLeft: 6 }}>{t.category_name}</span>
            </Select.Option>
          ))}
        </Select>
      </Modal>

      <Modal title="编辑咨询信息" open={!!editing} onOk={saveCustomer} onCancel={() => setEditing(null)}>
        <Form form={form} layout="vertical">
          <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="start_date" label="开始日期" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="end_date" label="结束日期" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item name="next_consultation" label="下次咨询"><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={logTarget ? `${logTarget.customer_name} · 咨询日志` : '咨询日志'}
        open={!!logTarget}
        onCancel={() => { setLogTarget(null); setEditingLog(null); logForm.resetFields() }}
        footer={null}
        width={860}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, maxHeight: 420, overflow: 'auto' }}>
            {logsLoading ? '加载中...' : logs.map(l => (
              <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{l.log_date} · {l.duration}分钟</strong>
                  <span>{l.consultant_name}{l.is_me ? '（我）' : ''}</span>
                </div>
                <div style={{ color: '#595959', marginTop: 4 }}>{l.summary || '—'}</div>
                {l.is_me && <Button size="small" style={{ marginTop: 6 }} onClick={() => { setEditingLog(l); logForm.setFieldsValue({ log_date: dayjs(l.log_date), duration: l.duration, summary: l.summary, content: l.content }) }}>编辑</Button>}
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{editingLog ? '编辑日志' : '上传新日志'}</div>
            <Form form={logForm} layout="vertical">
              <Form.Item name="log_date" label="日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="duration" label="时长（分钟）" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="summary" label="备注"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="content" label="会议记录"><Input.TextArea rows={4} /></Form.Item>
              <Button type="primary" onClick={submitLog} block>{editingLog ? '保存修改' : '新增日志'}</Button>
            </Form>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Pagination, Switch, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'

interface LogItem {
  id: string
  customer_id: string
  consultant_id: string
  consultant_name: string
  is_me: boolean
  editable: boolean
  log_date: string
  duration: number
  summary: string | null
  created_at: string
  updated_at: string
}

interface LogDetailItem extends LogItem {
  content: string | null
}

interface DetailItem {
  customer_id: string
  customer_name: string
  phone: string
  customer_info: string
  sales_name: string | null
  wechat_name: string | null
  tags: { id: string; name: string; color: string }[]
  products: { product_id: string; product_name: string; is_refunded: boolean }[]
  consultation_count: number
  total_duration: number
  latest_log_at: string | null
}

const PAGE_SIZE = 20
const DRAFT_KEY_PREFIX = 'consultant_log_draft_'

export default function ConsultantCustomerLogsPage() {
  const navigate = useNavigate()
  const { customerId = '' } = useParams()
  const [logs, setLogs] = useState<LogItem[]>([])
  const [detail, setDetail] = useState<DetailItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<LogItem | null>(null)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [keyword, setKeyword] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const draftKey = `${DRAFT_KEY_PREFIX}${customerId}`

  const fetchLogs = async (nextPage = page) => {
    setLoading(true)
    try {
      const q: string[] = [`page=${nextPage}`, `page_size=${PAGE_SIZE}`]
      if (keyword.trim()) q.push(`keyword=${encodeURIComponent(keyword.trim())}`)
      if (mineOnly) q.push('mine_only=true')
      if (dateRange[0]) q.push(`date_from=${dateRange[0].format('YYYY-MM-DD')}`)
      if (dateRange[1]) q.push(`date_to=${dateRange[1].format('YYYY-MM-DD')}`)
      const [logRes, detailRes] = await Promise.all([
        api.get<LogItem[]>(`/consultant/customers/${customerId}/consultation-logs?${q.join('&')}`),
        api.get<DetailItem>(`/consultant/customers/${customerId}/detail`),
      ])
      setLogs(logRes)
      setDetail(detailRes)
      setHasMore(logRes.length >= PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (customerId) void fetchLogs(1)
  }, [customerId, mineOnly, dateRange])

  const submit = async () => {
    const v = await form.validateFields()
    const payload = {
      log_date: dayjs(v.log_date).format('YYYY-MM-DD'),
      duration: v.duration,
      summary: v.summary ?? null,
      content: v.content ?? null,
    }
    if (editing) await api.put(`/consultant/logs/${editing.id}`, payload)
    else await api.post(`/consultant/customers/${customerId}/logs`, payload)
    message.success('已保存')
    localStorage.removeItem(draftKey)
    setEditing(null)
    setOpen(false)
    form.resetFields()
    void fetchLogs(1)
  }

  const openCreateModal = () => {
    setEditing(null)
    form.resetFields()
    const raw = localStorage.getItem(draftKey)
    if (raw) {
      try {
        const d = JSON.parse(raw) as { log_date?: string; duration?: number; summary?: string | null; content?: string | null }
        form.setFieldsValue({
          log_date: d.log_date ? dayjs(d.log_date) : dayjs(),
          duration: d.duration ?? 30,
          summary: d.summary ?? '',
          content: d.content ?? '',
        })
        message.info('已恢复上次草稿')
      } catch {
        form.setFieldsValue({ log_date: dayjs(), duration: 30, summary: '', content: '' })
      }
    } else {
      form.setFieldsValue({ log_date: dayjs(), duration: 30, summary: '', content: '' })
    }
    setOpen(true)
  }

  return (
    <div>
      <div className='page-header'>
        <div>
          <h2>客户咨询详情</h2>
          <p className='page-subtitle'>按时间倒序展示，咨询师可编辑自己的记录</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type='primary' onClick={openCreateModal}>新增日志</Button>
          <Button onClick={() => navigate('/consultant/customers')}>返回</Button>
        </div>
      </div>

      {detail ? (
        <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{detail.customer_name}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                {detail.phone} · {detail.customer_info || '-'} · 销售：{detail.sales_name || '-'} · 微信：{detail.wechat_name || '-'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ border: '1px solid #efefea', borderRadius: 8, padding: '8px 10px', minWidth: 110 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>咨询次数</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{detail.consultation_count}</div>
              </div>
              <div style={{ border: '1px solid #efefea', borderRadius: 8, padding: '8px 10px', minWidth: 130 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>累计时长</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{detail.total_duration} 分钟</div>
              </div>
              <div style={{ border: '1px solid #efefea', borderRadius: 8, padding: '8px 10px', minWidth: 160 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>最近咨询</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{detail.latest_log_at ? dayjs(detail.latest_log_at).format('M/D HH:mm') : '-'}</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {detail.tags.map((t) => <Tag key={t.id} color={t.color}>{t.name}</Tag>)}
            {detail.products.map((p) => (
              <Tag key={p.product_id} style={{ textDecoration: p.is_refunded ? 'line-through' : 'none', color: p.is_refunded ? '#cf1322' : '#135200', borderColor: 'transparent', background: p.is_refunded ? '#fff1f0' : '#e6fffb' }}>
                {p.product_name}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 260px 120px', gap: 8, alignItems: 'center' }}>
        <Input.Search
          allowClear
          value={keyword}
          placeholder='搜索摘要'
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => { setPage(1); void fetchLogs(1) }}
        />
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => {
            setPage(1)
            setDateRange([v?.[0] ?? null, v?.[1] ?? null])
          }}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>只看我的</span>
          <Switch checked={mineOnly} onChange={(v) => { setMineOnly(v); setPage(1) }} />
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 16 }}>
        {loading ? '加载中...' : logs.length === 0 ? (
          <div style={{ color: '#8c8c8c' }}>还没有咨询日志，先新增一条。</div>
        ) : logs.map((l) => (
          <div key={l.id} style={{ border: '1px solid #ecebe6', borderRadius: 12, padding: 14, marginBottom: 10, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {l.is_me && <span style={{ background: '#eaf8ee', color: '#166534', border: '1px solid #bfe7cb', borderRadius: 10, padding: '0 8px', fontSize: 11, lineHeight: '20px', fontWeight: 600 }}>最新</span>}
                <strong style={{ fontSize: 18 }}>第 {Math.max((detail?.consultation_count || logs.length) - logs.findIndex((it) => it.id === l.id), 1)} 次咨询</strong>
                <span style={{ color: '#8c8c8c', fontSize: 13 }}>{dayjs(l.log_date).format('M/D')} · {l.duration / 60 >= 1 ? `${(l.duration / 60).toFixed(1)}小时` : `${l.duration}分钟`}</span>
                <span style={{ background: '#f2f4f7', color: '#344054', borderRadius: 10, padding: '0 8px', fontSize: 11, lineHeight: '20px' }}>
                  {l.consultant_name}{l.is_me ? '（我）' : ''}
                </span>
              </div>
              {l.editable ? (
                <Button
                  size='small'
                  onClick={async () => {
                    const logDetail = await api.get<LogDetailItem>(`/consultant/logs/${l.id}`)
                    setEditing(l)
                    form.setFieldsValue({
                      log_date: dayjs(logDetail.log_date),
                      duration: logDetail.duration,
                      summary: logDetail.summary,
                      content: logDetail.content,
                    })
                    setOpen(true)
                  }}
                >
                  编辑
                </Button>
              ) : <Button size='small' disabled>查看</Button>}
            </div>
            <div style={{ marginTop: 10, color: '#1f2937', lineHeight: 1.7 }}>{l.summary || '-'}</div>
            <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 12 }}>更新于 {dayjs(l.updated_at).format('M/D HH:mm')}</div>
          </div>
        ))}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            size='small'
            current={page}
            pageSize={PAGE_SIZE}
            total={hasMore ? page * PAGE_SIZE + 1 : (page - 1) * PAGE_SIZE + logs.length}
            showSizeChanger={false}
            onChange={(p) => { setPage(p); void fetchLogs(p) }}
          />
        </div>
      </div>

      <Modal title={editing ? '编辑日志' : '新增日志'} open={open} onOk={submit} onCancel={() => { setOpen(false); setEditing(null) }} destroyOnClose>
        <Form
          form={form}
          layout='vertical'
          onValuesChange={() => {
            if (editing) return
            const values = form.getFieldsValue()
            const draft = {
              log_date: values.log_date ? dayjs(values.log_date).format('YYYY-MM-DD') : null,
              duration: values.duration ?? null,
              summary: values.summary ?? null,
              content: values.content ?? null,
            }
            localStorage.setItem(draftKey, JSON.stringify(draft))
          }}
        >
          <Form.Item name='log_date' label='日期' rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name='duration' label='时长（分钟）' rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ marginTop: -4, marginBottom: 10, display: 'flex', gap: 8 }}>
            {[15, 30, 45, 60].map((m) => <Button key={m} size='small' onClick={() => form.setFieldValue('duration', m)}>{m}分钟</Button>)}
          </div>
          <Form.Item name='summary' label='摘要' rules={[{ max: 60, message: '摘要最多 60 字' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name='content'
            label='内容'
            rules={[{
              validator: async (_, value: string | undefined) => {
                const text = (value || '').trim()
                if (text.length > 0 && text.length < 10) throw new Error('内容至少 10 字，或留空')
              },
            }]}
          >
            <Input.TextArea rows={5} />
          </Form.Item>
          <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: -6 }}>支持草稿暂存：未提交关闭后，下次新增日志会自动恢复。</div>
        </Form>
      </Modal>
    </div>
  )
}

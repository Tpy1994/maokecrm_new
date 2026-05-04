import { useEffect, useMemo, useState } from 'react'
import { Button, Input, InputNumber, Modal, Select, Table, Tag, message } from 'antd'
import { api } from '../../api/client'

interface CourseItem {
  enrollment_id: string
  product_name: string
  amount_paid: number
  status: string
  created_at: string
}

interface CustomerItem {
  customer_id: string
  customer_name: string
  phone: string
  sales_name: string | null
  total_spent: number
  gifted_tuition_amount: number
  tuition_balance: number
  pending_gift_request_count: number
  latest_pending_gift_note: string | null
  courses: CourseItem[]
}

interface ProductOption {
  id: string
  name: string
  price: number
  status: string
}

interface TuitionGiftRequestItem {
  id: string
  customer_id: string
  customer_name: string
  sales_user_name: string | null
  amount: number
  sales_note: string | null
  admin_note: string | null
  status: string
  reviewed_by_user_name: string | null
  reviewed_at: string | null
  created_at: string
}

interface SummaryItem {
  total_gifted: number
  total_spent: number
  last_month_spent: number
  total_balance: number
  total_pending: number
}

const y2f = (cents: number) => `￥${(cents / 100).toLocaleString()}`

export default function AdminTuitionAndWriteoffPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [writeoffOpen, setWriteoffOpen] = useState(false)
  const [writeoffForm, setWriteoffForm] = useState({ product_id: '', amount_yuan: 0, status: 'admin_marked_completed', note: '' })

  const [rows, setRows] = useState<TuitionGiftRequestItem[]>([])
  const [summary, setSummary] = useState<SummaryItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [activeStatus, setActiveStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [reviewing, setReviewing] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [adminNote, setAdminNote] = useState('')

  const fetchRows = async () => {
    setLoading(true)
    try {
      const data = await api.get<TuitionGiftRequestItem[]>(`/admin/tuition-gift-requests?status=${activeStatus}`)
      setRows(data)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    setSummary(await api.get<SummaryItem>('/admin/tuition-writeoff/summary'))
  }

  const fetchCustomers = async () => {
    const data = await api.get<CustomerItem[]>('/admin/tuition-writeoff/customers')
    setCustomers(data)
    if (!selectedCustomerId && data.length) setSelectedCustomerId(data[0].customer_id)
  }

  const fetchProducts = async () => {
    const data = await api.get<ProductOption[]>('/products')
    setProducts(data.filter((p) => p.status === 'active'))
  }

  const approve = async (id: string, note?: string) => {
    await api.post(`/admin/tuition-gift-requests/${id}/approve`, { admin_note: note || undefined })
    message.success('已通过')
    fetchRows()
    fetchCustomers()
  }

  const reject = async (id: string, note: string) => {
    await api.post(`/admin/tuition-gift-requests/${id}/reject`, { admin_note: note })
    message.success('已驳回')
    fetchRows()
    fetchCustomers()
  }

  useEffect(() => { void fetchRows() }, [activeStatus])
  useEffect(() => { void fetchCustomers(); void fetchProducts(); void fetchSummary() }, [])

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return rows
    return rows.filter((r) => r.customer_name.toLowerCase().includes(k) || (r.sales_note || '').toLowerCase().includes(k))
  }, [rows, keyword])

  const pendingCount = activeStatus === 'pending' ? rows.length : 0
  const selectedCustomer = customers.find((c) => c.customer_id === selectedCustomerId) || null
  const totalGifted = summary?.total_gifted ?? 0
  const totalSpent = summary?.total_spent ?? 0
  const totalBalance = summary?.total_balance ?? 0
  const lastMonthSpent = summary?.last_month_spent ?? 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>销课与充值</h2>
          <p className="page-subtitle">销售提交“赠送学费”申请后会推送至此处，管理员可审核通过或驳回；也可主动新增管理员销课记录。</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14 }}>
          <div style={{ color: '#8a8a8a', marginBottom: 4 }}>累计赠送学费</div>
          <div style={{ fontSize: 36, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{y2f(totalGifted)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #21a67a', borderLeftWidth: 4, borderRadius: 10, padding: 14 }}>
          <div style={{ color: '#8a8a8a', marginBottom: 4 }}>已销金额</div>
          <div style={{ fontSize: 36, lineHeight: 1, fontFamily: 'var(--font-mono)', color: '#16916a' }}>{y2f(totalSpent)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14 }}>
          <div style={{ color: '#8a8a8a', marginBottom: 4 }}>上月已销金额</div>
          <div style={{ fontSize: 36, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{y2f(lastMonthSpent)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #d08a23', borderLeftWidth: 4, borderRadius: 10, padding: 14 }}>
          <div style={{ color: '#8a8a8a', marginBottom: 4 }}>未销金额</div>
          <div style={{ fontSize: 36, lineHeight: 1, fontFamily: 'var(--font-mono)', color: '#b9771b' }}>{y2f(totalBalance)}</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #efefea', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700 }}>
              {activeStatus === 'pending' ? `待处理赠送学费，共 ${pendingCount} 个` : activeStatus === 'approved' ? '已通过记录' : '已驳回记录'}
            </div>
            <div style={{ color: '#8a8a8a', fontSize: 12, marginTop: 2 }}>审核通过后会直接增加客户学费结余。</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button size='small' type={activeStatus === 'pending' ? 'primary' : 'default'} onClick={() => setActiveStatus('pending')}>待处理</Button>
            <Button size='small' type={activeStatus === 'approved' ? 'primary' : 'default'} onClick={() => setActiveStatus('approved')}>已通过</Button>
            <Button size='small' type={activeStatus === 'rejected' ? 'primary' : 'default'} onClick={() => setActiveStatus('rejected')}>已驳回</Button>
            <Input.Search value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder='搜索客户' style={{ width: 240 }} />
          </div>
        </div>
        <Table
          rowKey="id"
          dataSource={filtered}
          loading={loading}
          pagination={false}
          columns={[
            { title: '客户', dataIndex: 'customer_name', width: 160 },
            { title: '标签', width: 120, render: () => <Tag color="gold">赠送学费</Tag> },
            { title: '销售备注', dataIndex: 'sales_note' },
            { title: '审核备注', dataIndex: 'admin_note', width: 180, render: (v: string | null) => v || '-' },
            { title: '来源销售', dataIndex: 'sales_user_name', width: 100, render: (v: string | null) => v || '-' },
            { title: '金额', dataIndex: 'amount', width: 100, render: (v: number) => y2f(v) },
            { title: '提交', dataIndex: 'created_at', width: 120, render: (v: string) => new Date(v).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
            { title: '审核人', dataIndex: 'reviewed_by_user_name', width: 90, render: (v: string | null) => v || '-' },
            { title: '审核时间', dataIndex: 'reviewed_at', width: 130, render: (v: string | null) => (v ? new Date(v).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-') },
            {
              title: '操作',
              width: 140,
              render: (_: unknown, r: TuitionGiftRequestItem) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  {activeStatus === 'pending' ? (
                    <>
                      <Button size='small' type='primary' onClick={() => { setReviewing({ id: r.id, action: 'approve' }); setAdminNote('') }}>通过</Button>
                      <Button size='small' danger onClick={() => { setReviewing({ id: r.id, action: 'reject' }); setAdminNote('') }}>驳回</Button>
                    </>
                  ) : (
                    <span style={{ color: '#8a8a8a', fontSize: 12 }}>已处理</span>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e8e8e3', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #efefea', fontWeight: 700 }}>全量客户（待处理赠送置顶）</div>
          <div style={{ maxHeight: 540, overflow: 'auto' }}>
            {customers.map((c) => {
              const active = c.customer_id === selectedCustomerId
              return (
                <button
                  key={c.customer_id}
                  onClick={() => setSelectedCustomerId(c.customer_id)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f3f3ef', background: active ? '#f7fbff' : '#fff', padding: '10px 12px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.customer_name}</div>
                    {c.pending_gift_request_count > 0 ? <Tag color='red'>待处理 {c.pending_gift_request_count}</Tag> : null}
                  </div>
                  <div style={{ color: '#8a8a8a', fontSize: 12 }}>{c.phone} · 销售：{c.sales_name || '-'}</div>
                  {c.latest_pending_gift_note ? <div style={{ color: '#595959', fontSize: 12, marginTop: 2 }}>备注：{c.latest_pending_gift_note}</div> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ border: '1px solid #e8e8e3', borderRadius: 10, background: '#fff', padding: 14 }}>
          {selectedCustomer ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedCustomer.customer_name}</div>
                  <div style={{ color: '#8a8a8a', fontSize: 12 }}>{selectedCustomer.phone} · 销售：{selectedCustomer.sales_name || '-'}</div>
                </div>
                <Button type='primary' onClick={() => setWriteoffOpen(true)}>新增管理员销课</Button>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ border: '1px solid #efefea', borderRadius: 8, padding: '8px 10px' }}>累计花费：{y2f(selectedCustomer.total_spent)}</div>
                <div style={{ border: '1px solid #efefea', borderRadius: 8, padding: '8px 10px' }}>赠送学费：{y2f(selectedCustomer.gifted_tuition_amount)}</div>
                <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 8, padding: '8px 10px', color: '#1d4ed8' }}>学费结余：{y2f(selectedCustomer.tuition_balance)}</div>
              </div>

              <Table
                rowKey='enrollment_id'
                dataSource={selectedCustomer.courses}
                pagination={false}
                size='small'
                columns={[
                  { title: '课程', dataIndex: 'product_name' },
                  { title: '金额', dataIndex: 'amount_paid', width: 100, render: (v: number) => y2f(v) },
                  { title: '状态', dataIndex: 'status', width: 180 },
                  { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => new Date(v).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                ]}
              />
            </>
          ) : (
            <div style={{ color: '#8a8a8a' }}>暂无客户</div>
          )}
        </div>
      </div>

      <Modal
        title={reviewing?.action === 'approve' ? '通过申请' : '驳回申请'}
        open={!!reviewing}
        onOk={async () => {
          if (!reviewing) return
          const note = adminNote.trim()
          if (reviewing.action === 'reject' && !note) {
            message.error('驳回时请填写审核备注')
            return
          }
          if (reviewing.action === 'approve') {
            await approve(reviewing.id, note)
          } else {
            await reject(reviewing.id, note)
          }
          setReviewing(null)
          setAdminNote('')
        }}
        onCancel={() => { setReviewing(null); setAdminNote('') }}
      >
        <Input.TextArea
          rows={4}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder={reviewing?.action === 'approve' ? '可选：填写审核备注' : '请填写驳回原因'}
        />
      </Modal>

      <Modal
        title='新增管理员销课'
        open={writeoffOpen}
        onOk={async () => {
          if (!selectedCustomer) return
          if (!writeoffForm.product_id) {
            message.error('请选择课程')
            return
          }
          await api.post(`/admin/customers/${selectedCustomer.customer_id}/writeoff-courses`, {
            product_id: writeoffForm.product_id,
            amount: Math.round(writeoffForm.amount_yuan * 100),
            status: writeoffForm.status,
            note: writeoffForm.note || undefined,
          })
          message.success('管理员销课记录已新增')
          setWriteoffOpen(false)
          setWriteoffForm({ product_id: '', amount_yuan: 0, status: 'admin_marked_completed', note: '' })
          await fetchCustomers()
        }}
        onCancel={() => setWriteoffOpen(false)}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <Select
            value={writeoffForm.product_id || undefined}
            placeholder='选择课程'
            onChange={(v) => {
              const p = products.find((item) => item.id === v)
              setWriteoffForm((prev) => ({ ...prev, product_id: v, amount_yuan: p ? p.price / 100 : 0 }))
            }}
            options={products.map((p) => ({ value: p.id, label: `${p.name}（${y2f(p.price)}）` }))}
          />
          <InputNumber
            min={0}
            precision={2}
            style={{ width: '100%' }}
            addonBefore='销课金额(元)'
            value={writeoffForm.amount_yuan}
            onChange={(v) => setWriteoffForm((prev) => ({ ...prev, amount_yuan: Number(v || 0) }))}
          />
          <Select
            value={writeoffForm.status}
            onChange={(v) => setWriteoffForm((prev) => ({ ...prev, status: v }))}
            options={[
              { value: 'admin_marked_completed', label: '管理员销课已上（扣结余）' },
              { value: 'admin_marked_completed_refunded', label: '管理员销课+退款' },
            ]}
          />
          <Input.TextArea
            rows={3}
            value={writeoffForm.note}
            onChange={(e) => setWriteoffForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder='备注（可选）'
          />
        </div>
      </Modal>
    </div>
  )
}

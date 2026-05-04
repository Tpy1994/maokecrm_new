import { useEffect, useMemo, useState } from 'react'
import { Button, Input, InputNumber, Modal, Select, Table, Tag, message } from 'antd'
import { api } from '../../api/client'

interface CourseItem {
  enrollment_id: string
  product_id?: string
  product_name: string
  amount_paid: number
  refunded_amount: number
  status: string
  created_at: string
}

interface CustomerItem {
  customer_id: string
  customer_name: string
  phone: string
  sales_name: string | null
  tags: { id: string; name: string; color: string }[]
  consult_count: number
  wechat_name: string | null
  sales_note: string | null
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

type CourseStatusKey =
  | 'purchased_not_started'
  | 'sales_marked_completed'
  | 'purchased_not_started_refunded'
  | 'sales_marked_completed_refunded'
  | 'admin_marked_completed'
  | 'admin_marked_completed_refunded'

const COURSE_STATUS_META: Record<CourseStatusKey, { label: string; bg: string; color: string; border: string }> = {
  purchased_not_started: { label: '已购未上', bg: '#FDECEC', color: '#B42318', border: '#F7CACA' },
  sales_marked_completed: { label: '销售标记已上', bg: '#EAF8EE', color: '#166534', border: '#BFE7CB' },
  purchased_not_started_refunded: { label: '已购未上+退款', bg: '#FDECEC', color: '#B42318', border: '#F7CACA' },
  sales_marked_completed_refunded: { label: '销售标记已上+退款', bg: '#EAF8EE', color: '#166534', border: '#BFE7CB' },
  admin_marked_completed: { label: '管理员销课已上', bg: '#EAF2FF', color: '#1D4ED8', border: '#BFDBFE' },
  admin_marked_completed_refunded: { label: '管理员销课+退款', bg: '#EAF2FF', color: '#1D4ED8', border: '#BFDBFE' },
}

const y2f = (yuan: number) => `￥${Number(yuan || 0).toLocaleString()}`
export default function AdminTuitionAndWriteoffPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [writeoffOpen, setWriteoffOpen] = useState(false)
  const [writeoffForm, setWriteoffForm] = useState({ product_id: '', amount: 0, note: '' })
  const [activeCourseKey, setActiveCourseKey] = useState<string | null>(null)
  const [refundTarget, setRefundTarget] = useState<{ customerId: string; enrollmentId: string; maxRefund: number } | null>(null)
  const [refundAmount, setRefundAmount] = useState<number>(0)
  const [refundingId, setRefundingId] = useState<string | null>(null)

  const [rows, setRows] = useState<TuitionGiftRequestItem[]>([])
  const [summary, setSummary] = useState<SummaryItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [reviewKeyword, setReviewKeyword] = useState('')
  const [writeoffKeyword, setWriteoffKeyword] = useState('')
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
    const q = writeoffKeyword.trim()
    const query = q ? `?keyword=${encodeURIComponent(q)}` : ''
    const data = await api.get<CustomerItem[]>(`/admin/tuition-writeoff/customers${query}`)
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
    fetchSummary()
  }

  const reject = async (id: string, note: string) => {
    await api.post(`/admin/tuition-gift-requests/${id}/reject`, { admin_note: note })
    message.success('已驳回')
    fetchRows()
    fetchCustomers()
    fetchSummary()
  }

  const refundCourse = async (customerId: string, enrollmentId: string, refundAmountYuan: number) => {
    setRefundingId(enrollmentId)
    try {
      await api.put(`/admin/customers/${customerId}/courses/${enrollmentId}/status`, {
        status: 'admin_marked_completed_refunded',
        refund_amount: refundAmountYuan,
      })
      message.success('已退款')
      await fetchCustomers()
      await fetchSummary()
    } finally {
      setRefundingId(null)
    }
  }

  const revertRefundCourse = async (customerId: string, enrollmentId: string) => {
    setRefundingId(enrollmentId)
    try {
      await api.put(`/admin/customers/${customerId}/courses/${enrollmentId}/status`, {
        status: 'admin_marked_completed',
      })
      message.success('已撤销退款')
      await fetchCustomers()
      await fetchSummary()
    } finally {
      setRefundingId(null)
    }
  }

  useEffect(() => { void fetchRows() }, [activeStatus])
  useEffect(() => { void fetchProducts(); void fetchSummary() }, [])
  useEffect(() => { void fetchCustomers() }, [writeoffKeyword])
  useEffect(() => {
    const onDocMouseDown = (evt: MouseEvent) => {
      if (refundTarget) return
      if (!activeCourseKey) return
      const target = evt.target as HTMLElement | null
      if (target && target.closest('[data-admin-course-op]')) return
      setActiveCourseKey(null)
    }
    const onEsc = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setActiveCourseKey(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [activeCourseKey, refundTarget])

  const filtered = useMemo(() => {
    const k = reviewKeyword.trim().toLowerCase()
    if (!k) return rows
    return rows.filter((r) => r.customer_name.toLowerCase().includes(k) || (r.sales_note || '').toLowerCase().includes(k))
  }, [rows, reviewKeyword])

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
            <Input.Search value={reviewKeyword} onChange={(e) => setReviewKeyword(e.target.value)} placeholder='搜索客户' style={{ width: 240 }} />
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

      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #efefea', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>待销课处理</div>
            <div style={{ color: '#8a8a8a', fontSize: 12, marginTop: 4 }}>当前筛选共 {customers.length} 个客户</div>
          </div>
          <Input.Search
            allowClear
            value={writeoffKeyword}
            placeholder='搜索客户名/标签/备注'
            style={{ width: 320 }}
            onChange={(e) => setWriteoffKeyword(e.target.value)}
            onSearch={(value) => setWriteoffKeyword(value)}
          />
        </div>
        <Table
          size='small'
          rowKey='customer_id'
          dataSource={customers}
          pagination={{ pageSize: 8, size: 'small' }}
          columns={[
            {
              title: '客户',
              width: 180,
              render: (_: unknown, c: CustomerItem) => (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{c.customer_name}</div>
                  <div style={{ color: '#6b7280', marginTop: 4, fontSize: 12 }}>{c.phone}</div>
                </div>
              ),
            },
            {
              title: '标签',
              width: 180,
              render: (_: unknown, c: CustomerItem) => (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.tags.length ? c.tags.map((t) => <Tag key={t.id} color={t.color}>{t.name}</Tag>) : <span style={{ color: '#9ca3af' }}>-</span>}
                </div>
              ),
            },
            {
              title: '已购课程',
              width: 360,
              render: (_: unknown, c: CustomerItem) => (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.courses.length ? c.courses.map((course) => (
                    (() => {
                      const courseKey = `${c.customer_id}:${course.enrollment_id}`
                      const meta = COURSE_STATUS_META[course.status as CourseStatusKey]
                      const isActive = activeCourseKey === courseKey
                      const maxRefund = Math.max(course.amount_paid - (course.refunded_amount || 0), 0)
                      return (
                        <div key={course.enrollment_id} data-admin-course-op style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <button
                            onClick={() => setActiveCourseKey((curr) => (curr === courseKey ? null : courseKey))}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              border: `1px solid ${isActive ? '#3B82F6' : (meta?.border || '#d9d9d9')}`,
                              background: meta?.bg || '#f5f5f5',
                              color: meta?.color || '#595959',
                              borderRadius: 4,
                              padding: '1px 6px',
                              fontSize: 11,
                              lineHeight: '16px',
                              maxWidth: 180,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ textDecoration: course.status.includes('refunded') ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {course.product_name}
                            </span>
                          </button>
                          {isActive ? (
                            <div style={{ border: '1px solid #e5e7eb', background: '#fafafa', borderRadius: 6, padding: '5px 6px', width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 10, color: '#6b7280' }}>操作区</span>
                                <button onClick={() => setActiveCourseKey(null)} style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</button>
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                {course.status === 'admin_marked_completed' || course.status === 'admin_marked_completed_refunded' ? (
                                  <>
                                    {maxRefund > 0 ? (
                                      <button
                                        disabled={refundingId === course.enrollment_id}
                                        onClick={() => {
                                          setRefundTarget({ customerId: c.customer_id, enrollmentId: course.enrollment_id, maxRefund })
                                          setRefundAmount(Number(maxRefund.toFixed(2)))
                                        }}
                                        style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, fontSize: 10, padding: '0 6px', cursor: 'pointer' }}
                                      >
                                        退款
                                      </button>
                                    ) : null}
                                    {course.status === 'admin_marked_completed_refunded' ? (
                                      <button
                                        disabled={refundingId === course.enrollment_id}
                                        onClick={() => { void revertRefundCourse(c.customer_id, course.enrollment_id) }}
                                        style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, fontSize: 10, padding: '0 6px', cursor: 'pointer' }}
                                      >
                                        撤销退款
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                                <span style={{ fontSize: 10, color: '#6b7280' }}>{y2f(course.amount_paid)} / 已退 {y2f(course.refunded_amount || 0)}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })()
                  )) : <span style={{ color: '#9ca3af' }}>-</span>}
                </div>
              ),
            },
            { title: '学费结余', dataIndex: 'tuition_balance', width: 140, render: (v: number) => <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>{y2f(v)}</span> },
            { title: '备注', dataIndex: 'sales_note', width: 200, render: (v: string | null) => v || '-' },
            { title: '咨询次数', dataIndex: 'consult_count', width: 100, render: (v: number) => v ?? 0 },
            { title: '绑定微信', dataIndex: 'wechat_name', width: 180, render: (v: string | null) => v || '-' },
            {
              title: '操作',
              width: 130,
              render: (_: unknown, c: CustomerItem) => (
                <Button
                  size='small'
                  type='primary'
                  onClick={() => {
                    setSelectedCustomerId(c.customer_id)
                    setWriteoffOpen(true)
                  }}
                >
                  新增销课
                </Button>
              ),
            },
          ]}
        />
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
            amount: writeoffForm.amount,
            status: 'admin_marked_completed',
            note: writeoffForm.note || undefined,
          })
          message.success('管理员销课记录已新增')
          setWriteoffOpen(false)
          setWriteoffForm({ product_id: '', amount: 0, note: '' })
          await fetchCustomers()
          await fetchSummary()
        }}
        onCancel={() => setWriteoffOpen(false)}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <Select
            value={writeoffForm.product_id || undefined}
            placeholder='选择课程'
            onChange={(v) => {
              const p = products.find((item) => item.id === v)
              setWriteoffForm((prev) => ({ ...prev, product_id: v, amount: p ? Number(p.price) : 0 }))
            }}
            options={products.map((p) => ({ value: p.id, label: `${p.name}（${y2f(p.price)}）` }))}
          />
          <InputNumber
            min={0}
            precision={2}
            style={{ width: '100%' }}
            addonBefore='销课金额(元)'
            value={writeoffForm.amount}
            onChange={(v) => setWriteoffForm((prev) => ({ ...prev, amount: Number(v || 0) }))}
          />
          <Input.TextArea
            rows={3}
            value={writeoffForm.note}
            onChange={(e) => setWriteoffForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder='备注（可选）'
          />
        </div>
      </Modal>

      <Modal
        title='销课退款'
        open={!!refundTarget}
        confirmLoading={refundingId !== null}
        onOk={async () => {
          if (!refundTarget) return
          if (refundAmount <= 0) {
            message.error('请输入退款金额')
            return
          }
          if (refundAmount > refundTarget.maxRefund) {
            message.error('退款金额不能超过可退金额')
            return
          }
          await refundCourse(refundTarget.customerId, refundTarget.enrollmentId, refundAmount)
          setRefundTarget(null)
        }}
        onCancel={() => setRefundTarget(null)}
      >
        <InputNumber
          min={0.01}
          precision={2}
          style={{ width: '100%' }}
          addonBefore='退款金额(元)'
          value={refundAmount}
          onChange={(v) => setRefundAmount(Number(v || 0))}
        />
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
          最多可退：{refundTarget ? y2f(refundTarget.maxRefund) : '¥0.00'}
        </div>
      </Modal>

    </div>
  )
}

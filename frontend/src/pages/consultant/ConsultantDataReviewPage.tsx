import { useEffect, useState } from 'react'
import { Progress, Select } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../api/client'

interface TagDist { tag_id: string; name: string; color: string; count: number; percent: number }
interface Dashboard {
  service_customers: number
  co_service_customers: number
  meetings_this_month: number
  meetings_last_month: number
  active_customers_with_meeting_this_month: number
  active_customers_without_meeting_this_month: number
  avg_meeting_per_service_customer: number
  total_meetings: number
  label_distribution: TagDist[]
}

export default function ConsultantDataReviewPage() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [data, setData] = useState<Dashboard | null>(null)

  const fetchData = async (m = month) => {
    setData(await api.get<Dashboard>(`/consultant/dashboard?month=${m}`))
  }

  useEffect(() => { fetchData(dayjs().format('YYYY-MM')) }, [])

  if (!data) return null

  const cards = [
    { label: '在服务客户', value: `${data.service_customers}`, hint: `含 ${data.co_service_customers} 个联合服务` },
    { label: '本月会议数', value: `${data.meetings_this_month}`, hint: `上月 ${data.meetings_last_month}` },
    { label: '本月服务客户数', value: `${data.active_customers_with_meeting_this_month}`, hint: `${data.active_customers_without_meeting_this_month} 个客户本月暂无会议` },
    { label: '在服务客户累计平均会议数', value: `${data.avg_meeting_per_service_customer}`, hint: `总会议 ${data.total_meetings} / 客户 ${data.service_customers}` },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>数据复盘</h2>
          <p className="page-subtitle">{dayjs(month + '-01').format('YYYY 年 M 月 D 日')}</p>
        </div>
        <Select
          value={month}
          style={{ width: 260 }}
          onChange={(v) => { setMonth(v); fetchData(v) }}
          options={Array.from({ length: 12 }).map((_, i) => {
            const d = dayjs().subtract(i, 'month')
            return { label: d.format('YYYY 年 M 月'), value: d.format('YYYY-MM') }
          })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {cards.map((c, idx) => (
          <div key={idx} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{c.label}</div>
            <div style={{ fontSize: 42, fontWeight: 700, color: idx === 3 ? '#16A34A' : '#0E0E0E', lineHeight: 1.05, marginTop: 6 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#B8B8B8', marginTop: 4 }}>{c.hint}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0E0E0E', margin: '0 0 4px' }}>在服务客户的标签分布</h3>
        <p style={{ fontSize: 12, color: '#8E8E8E', margin: '0 0 14px' }}>按比例从高到低排序 · 概率 = 该标签客户数 / 在服务客户 {data.service_customers}</p>

        {data.label_distribution.map((item) => (
          <div key={item.tag_id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 3, background: '#EEF2FF', color: '#3730A3' }}>{item.name}</span>
                <span style={{ color: '#8E8E8E', fontSize: 12 }}>{item.count}个客户</span>
              </div>
              <span style={{ color: '#16A34A', fontSize: 18, fontWeight: 700 }}>{item.percent}%</span>
            </div>
            <Progress percent={item.percent} showInfo={false} strokeColor="#16A34A" trailColor="#F2F2ED" />
          </div>
        ))}
      </div>
    </div>
  )
}

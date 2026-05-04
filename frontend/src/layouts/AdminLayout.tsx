import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'

const menuItems = [
  { key: '/admin/data-review', label: '数据复盘' },
  { key: '/admin/personnel', label: '人员管理' },
  { key: '/admin/link-accounts', label: '工作账号管理' },
  { key: '/admin/customers', label: '客户资产' },
  { key: '/admin/pool', label: '咨询池' },
  { key: '/admin/tags', label: '标签管理' },
  { key: '/admin/products', label: '产品管理' },
  { key: '/admin/tuition-writeoff', label: '销课与充值' },
  { key: '/admin/audit-logs', label: '操作日志' },
]

const contentWidth = 1280

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [tuitionPendingCount, setTuitionPendingCount] = useState(0)

  useEffect(() => {
    let mounted = true
    api.get<Array<{ id: string }>>('/admin/tuition-gift-requests?status=pending')
      .then((rows) => { if (mounted) setTuitionPendingCount(rows.length) })
      .catch(() => { if (mounted) setTuitionPendingCount(0) })
    return () => { mounted = false }
  }, [location.pathname])

  return (
    <div style={{ minHeight: '100vh', background: '#FDFDF7', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#FDFDF7', borderBottom: '1px solid #E8E8E3' }}>
        <div style={{ maxWidth: contentWidth, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div onClick={() => navigate('/admin/data-review')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect width="22" height="22" rx="5" fill="#0E0E0E"/>
              <path d="M6 16V7L11 12L16 7V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0E0E0E', letterSpacing: '-0.01em' }}>猫课·管理员</span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, padding: 4, background: '#F2F2ED', borderRadius: 10, overflowX: 'auto' }}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  style={{
                    padding: '6px 16px', border: 'none', borderRadius: 7,
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#0E0E0E' : '#73726c',
                    fontWeight: isActive ? 500 : 430, fontSize: 13,
                    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'color 0.12s, background-color 0.12s',
                    display: 'inline-flex', alignItems: 'center',
                  }}
                >
                  <span>{item.label}</span>
                  {item.key === '/admin/tuition-writeoff' && tuitionPendingCount > 0 ? (
                    <span style={{ marginLeft: 6, color: '#B42318', fontSize: 11, fontWeight: 700 }}>{tuitionPendingCount}</span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <UserOutlined style={{ color: '#8E8E8E', fontSize: 14 }} />
            <span style={{ fontSize: 13, color: '#4A4A4A', fontWeight: 500, whiteSpace: 'nowrap' }}>{user?.name}</span>
            <button
              onClick={logout}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8E8E8E', fontSize: 13, padding: '4px 8px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
            >
              <LogoutOutlined style={{ fontSize: 13 }} /> 退出
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: 24, maxWidth: contentWidth, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  )
}

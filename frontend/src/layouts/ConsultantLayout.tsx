import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/authStore'

const menuItems = [
  { key: '/consultant/customers', label: '我的咨询客户' },
  { key: '/consultant/data-review', label: '数据复盘' },
  { key: '/consultant/pool', label: '咨询池' },
]

const contentWidth = 1280

export default function ConsultantLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  return (
    <div style={{ minHeight: '100vh', background: '#FDFDF7', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#FDFDF7', borderBottom: '1px solid #E8E8E3' }}>
        <div style={{ maxWidth: contentWidth, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div onClick={() => navigate('/consultant/customers')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect width="22" height="22" rx="5" fill="#0E0E0E"/>
              <path d="M6 16V7L11 12L16 7V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0E0E0E', letterSpacing: '-0.01em' }}>猫课 · 咨询师</span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, padding: 4, background: '#F2F2ED', borderRadius: 10 }}>
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
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#3d3d3a' }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#73726c' }}
                >
                  {item.label}
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
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F2F2ED'; (e.currentTarget as HTMLElement).style.color = '#0E0E0E' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#8E8E8E' }}
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

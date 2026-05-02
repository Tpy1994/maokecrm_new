import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, message } from 'antd'
import { PhoneOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login, fetchUser } = useAuthStore()

  const onFinish = async (values: { phone: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.phone, values.password)
      await fetchUser()
      const user = useAuthStore.getState().user
      if (user) {
        const routes: Record<string, string> = {
          sales: '/sales/customers',
          consultant: '/consultant/customers',
          admin: '/admin/data-review',
        }
        navigate(routes[user.role] || '/login', { replace: true })
      }
      message.success('登录成功')
    } catch {
      message.error('手机号或密码错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#FDFDF7',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 380,
          background: '#FFFFFF',
          border: '1px solid #E8E8E3',
          borderRadius: 12,
          padding: '40px 36px 32px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 16 }}>
            <rect width="40" height="40" rx="10" fill="#0E0E0E"/>
            <path d="M10 28V12L20 21L30 12V28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0E0E0E', letterSpacing: '-0.01em', marginBottom: 4 }}>
            猫课 CRM
          </h1>
          <p style={{ fontSize: 13, color: '#8E8E8E', margin: 0 }}>
            电商教育客户关系管理系统
          </p>
        </div>

        <Form onFinish={onFinish} size="large">
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input
              prefix={<PhoneOutlined style={{ color: '#B8B8B8' }} />}
              placeholder="手机号"
              style={{ borderRadius: 8, height: 42 }}
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#B8B8B8' }} />}
              placeholder="密码"
              style={{ borderRadius: 8, height: 42 }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 8,
                border: 'none',
                background: '#0E0E0E',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#4A4A4A' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0E0E0E' }}
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

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
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            <img
              src='/login-logo.png'
              alt='猫课CRM'
              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }}
            />
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0B2A66', letterSpacing: '0.01em', margin: 0 }}>
              猫课CRM
            </h1>
          </div>
          <p style={{ fontSize: 14, color: '#6B7A90', margin: 0, letterSpacing: '0.02em', textAlign: 'center' }}>
            客户管理 · 线索跟进 · 高效协同
          </p>
        </div>

        <Form onFinish={onFinish} size='large'>
          <Form.Item name='phone' rules={[{ required: true, message: '请输入手机号' }]}>
            <Input
              prefix={<PhoneOutlined style={{ color: '#B8B8B8' }} />}
              placeholder='手机号'
              style={{ borderRadius: 8, height: 42 }}
            />
          </Form.Item>
          <Form.Item name='password' rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#B8B8B8' }} />}
              placeholder='密码'
              style={{ borderRadius: 8, height: 42 }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <button
              type='submit'
              disabled={loading}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 8,
                border: 'none',
                background: '#0B2A66',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#14408F' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0B2A66' }}
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import LoginPage from './pages/login/LoginPage'
import SalesLayout from './layouts/SalesLayout'
import ConsultantLayout from './layouts/ConsultantLayout'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import ProductsPage from './pages/admin/ProductsPage'
import TagsPage from './pages/admin/TagsPage'
import PersonnelPage from './pages/admin/PersonnelPage'
import LinkAccountsPage from './pages/admin/LinkAccountsPage'
import CustomerList from './pages/sales/CustomerList'
import DataReview from './pages/sales/DataReview'
import ConsultantCustomersPage from './pages/consultant/ConsultantCustomersPage'
import ConsultantDataReviewPage from './pages/consultant/ConsultantDataReviewPage'
import ConsultantPoolPage from './pages/consultant/ConsultantPoolPage'

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute allowedRoles={['sales']} />}>
            <Route element={<SalesLayout />}>
              <Route path="/sales/customers" element={<CustomerList />} />
              <Route path="/sales/data-review" element={<DataReview />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['consultant']} />}>
            <Route element={<ConsultantLayout />}>
              <Route path="/consultant/customers" element={<ConsultantCustomersPage />} />
              <Route path="/consultant/data-review" element={<ConsultantDataReviewPage />} />
              <Route path="/consultant/pool" element={<ConsultantPoolPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/data-review" element={<div>数据复盘（开发中）</div>} />
              <Route path="/admin/personnel" element={<PersonnelPage />} />
              <Route path="/admin/link-accounts" element={<LinkAccountsPage />} />
              <Route path="/admin/customers" element={<div>客户资产（开发中）</div>} />
              <Route path="/admin/pool" element={<div>咨询池（开发中）</div>} />
              <Route path="/admin/tags" element={<TagsPage />} />
              <Route path="/admin/products" element={<ProductsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

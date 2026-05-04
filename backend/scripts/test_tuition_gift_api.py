from fastapi.testclient import TestClient
from app.main import app


def main():
    client = TestClient(app)

    login = client.post('/api/v1/auth/login', json={'phone': '13800000001', 'password': 'demo123'})
    print('login_status=', login.status_code)
    if login.status_code != 200:
        print('login_body=', login.text)
        return

    token = login.json().get('access_token')
    headers = {'Authorization': f'Bearer {token}'}

    r_list = client.get('/api/v1/sales/tuition-gift-requests', headers=headers)
    print('list_status=', r_list.status_code)
    print('list_body=', r_list.text[:500])

    # choose one customer from sales list for create test
    r_customers = client.get('/api/v1/sales/customers', headers=headers)
    print('customers_status=', r_customers.status_code)
    if r_customers.status_code != 200:
        print('customers_body=', r_customers.text)
        return
    rows = r_customers.json()
    if not rows:
        print('no customers, skip create test')
        return

    customer_id = rows[0]['id']
    r_create = client.post(
        '/api/v1/sales/tuition-gift-requests',
        headers=headers,
        json={'customer_id': customer_id, 'amount': 100, 'sales_note': '接口验证脚本创建'}
    )
    print('create_status=', r_create.status_code)
    print('create_body=', r_create.text)

    r_list2 = client.get('/api/v1/sales/tuition-gift-requests', headers=headers)
    print('list2_status=', r_list2.status_code)
    print('list2_body=', r_list2.text[:500])


if __name__ == '__main__':
    main()

import httpx
import asyncio

BASE = "http://localhost:8000/api/v1"

async def test():
    async with httpx.AsyncClient(timeout=10) as c:
        # 1. Login
        r = await c.post(f"{BASE}/auth/login", json={"phone": "13800000000", "password": "admin123"})
        assert r.status_code == 200, f"Login failed: {r.text}"
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[OK] Login")

        # 2. Me
        r = await c.get(f"{BASE}/auth/me", headers=headers)
        assert r.json()["role"] == "admin"
        print("[OK] GET /me")

        # 3. Products CRUD
        r = await c.post(f"{BASE}/products/", json={"name": "电商管理课", "price": 29900, "is_consultation": False}, headers=headers)
        assert r.status_code == 201
        pid = r.json()["id"]
        print(f"[OK] POST product: {pid}")

        r = await c.get(f"{BASE}/products/", headers=headers)
        assert len(r.json()) >= 1
        print("[OK] GET products")

        r = await c.put(f"{BASE}/products/{pid}", json={"price": 39900}, headers=headers)
        assert r.json()["price"] == 39900
        print("[OK] PUT product")

        # 4. Tag categories + tags
        r = await c.post(f"{BASE}/tags/categories", json={"name": "行业类目", "group": "sales"}, headers=headers)
        assert r.status_code == 201
        cat_id = r.json()["id"]
        print(f"[OK] POST category: {cat_id}")

        r = await c.put(f"{BASE}/tags/categories/{cat_id}", json={"color": "#52c41a"}, headers=headers)
        assert r.json()["color"] == "#52c41a"
        print("[OK] PUT category color")

        r = await c.post(f"{BASE}/tags/categories/{cat_id}/tags", json={"name": "服装类"}, headers=headers)
        assert r.status_code == 201
        tag_id = r.json()["id"]
        print(f"[OK] POST tag: {tag_id}")

        r = await c.get(f"{BASE}/tags/categories/{cat_id}/tags", headers=headers)
        assert len(r.json()) >= 1
        print("[OK] GET tags")

        # 5. Users
        r = await c.post(f"{BASE}/users/", json={"name": "测试销售", "phone": "13800000001", "password": "test123", "role": "sales"}, headers=headers)
        assert r.status_code == 201
        uid = r.json()["id"]
        print(f"[OK] POST user: {uid}")

        r = await c.get(f"{BASE}/users/", headers=headers)
        assert len(r.json()) >= 2
        print("[OK] GET users")

        # 6. Link accounts
        r = await c.post(f"{BASE}/link-accounts/", json={"account_id": "wxid_test001", "owner_id": uid}, headers=headers)
        assert r.status_code == 201
        aid = r.json()["id"]
        print(f"[OK] POST link-account: {aid}")

        r = await c.get(f"{BASE}/link-accounts/", headers=headers)
        assert len(r.json()) >= 1
        print("[OK] GET link-accounts")

        # Transfer
        r = await c.post(f"{BASE}/link-accounts/{aid}/transfer", json={"target_user_id": uid, "reason": "测试流转"}, headers=headers)
        assert r.status_code == 200
        print("[OK] Transfer")

        print("\nAll tests passed!")

asyncio.run(test())

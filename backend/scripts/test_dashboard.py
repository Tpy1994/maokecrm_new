import httpx, asyncio, json

async def test():
    async with httpx.AsyncClient() as c:
        r = await c.post("http://localhost:8000/api/v1/auth/login", json={"phone": "13800000001", "password": "demo123"})
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        r = await c.get("http://localhost:8000/api/v1/sales/dashboard", headers=h)
        print(f"Status: {r.status_code}")
        data = r.json()
        print(json.dumps(data["stats"], indent=2, ensure_ascii=False))
        print(f"Orders: {len(data['monthly_orders'])}")

asyncio.run(test())

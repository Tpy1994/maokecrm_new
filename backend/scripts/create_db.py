import asyncio
import asyncpg

async def check_and_create():
    conn = await asyncpg.connect(
        host='192.168.3.16', port=5432,
        user='root', password='sk1234',
        database='postgres'
    )
    dbs = await conn.fetch("SELECT datname FROM pg_database WHERE datname = $1", 'maoke_crm')
    if not dbs:
        await conn.execute('CREATE DATABASE maoke_crm')
        print('Database maoke_crm created')
    else:
        print('Database maoke_crm already exists')
    await conn.close()

asyncio.run(check_and_create())

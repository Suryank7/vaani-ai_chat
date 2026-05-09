from g4f.client import AsyncClient
import g4f
import asyncio

async def test_llm():
    try:
        client = AsyncClient(provider=g4f.Provider.PollinationsAI)
        response = await client.chat.completions.create(
            model="openai",
            messages=[{"role": "user", "content": "Say hello in 3 words"}],
        )
        print("POLLINATIONS ASYNC SUCCESS:", response.choices[0].message.content)
        return True
    except Exception as e:
        print("POLLINATIONS ASYNC ERROR:", str(e))
        return False

asyncio.run(test_llm())

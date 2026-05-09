"""Find working model+provider combinations on HF Router API."""
import os
import sys
import requests
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

token = os.getenv("HF_TOKEN")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Step 1: Verify token is valid
print("=== Token Check ===")
r = requests.get("https://huggingface.co/api/whoami", headers={"Authorization": f"Bearer {token}"})
print(f"Status: {r.status_code}")
if r.ok:
    print(f"User: {r.json().get('name', '?')}")
else:
    print(f"INVALID TOKEN: {r.text[:100]}")
    sys.exit(1)

# Step 2: Try many provider+model combos
combos = [
    # (provider, model)
    ("novita", "meta-llama/Llama-3.1-8B-Instruct"),
    ("novita", "Qwen/Qwen2.5-7B-Instruct"),
    ("novita", "mistralai/Mistral-7B-Instruct-v0.3"),
    ("together", "meta-llama/Llama-3.1-8B-Instruct"),
    ("together", "mistralai/Mistral-7B-Instruct-v0.3"),
    ("fireworks-ai", "meta-llama/Llama-3.1-8B-Instruct"),
    ("sambanova", "meta-llama/Llama-3.1-8B-Instruct"),
    ("sambanova", "Qwen/Qwen2.5-72B-Instruct"),
    ("hf-inference", "meta-llama/Llama-3.2-1B-Instruct"),
    ("hf-inference", "google/gemma-2-2b-it"),
    ("hf-inference", "HuggingFaceH4/zephyr-7b-beta"),
    ("hf-inference", "mistralai/Mistral-7B-Instruct-v0.3"),
    ("hf-inference", "Qwen/Qwen2.5-Coder-32B-Instruct"),
    ("hf-inference", "microsoft/Phi-3-mini-4k-instruct"),
    ("cerebras", "meta-llama/Llama-3.1-8B-Instruct"),
    ("groq", "meta-llama/Llama-3.1-8B-Instruct"),
]

working = []

for provider, model in combos:
    try:
        r = requests.post(
            f"https://router.huggingface.co/{provider}/v1/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": "Say hi"}],
                "max_tokens": 10,
            },
            timeout=15,
        )
        status = "OK" if r.ok else f"FAIL({r.status_code})"
        detail = ""
        if r.ok:
            detail = r.json()["choices"][0]["message"]["content"][:50]
            working.append((provider, model))
        else:
            detail = r.text[:80]
        print(f"  {status} | {provider:15s} | {model:45s} | {detail}")
    except Exception as e:
        print(f"  ERR  | {provider:15s} | {model:45s} | {str(e)[:50]}")

print(f"\n=== WORKING COMBOS: {len(working)} ===")
for p, m in working:
    print(f"  {p} / {m}")

# Step 3: Test STT (Whisper) endpoint
print("\n=== Testing Whisper STT ===")
stt_combos = [
    ("hf-inference", "openai/whisper-large-v3"),
    ("hf-inference", "openai/whisper-large-v3-turbo"),
    ("hf-inference", "openai/whisper-small"),
]
for provider, model in stt_combos:
    try:
        r = requests.post(
            f"https://router.huggingface.co/{provider}/models/{model}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "audio/wav"},
            data=b"\x00" * 100,
            timeout=10,
        )
        print(f"  {r.status_code} | {provider} / {model} | {r.text[:100]}")
    except Exception as e:
        print(f"  ERR  | {provider} / {model} | {e}")

print("\n=== DONE ===")

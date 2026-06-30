#!/usr/bin/env python3
"""
Workflow n8n que pinga o Supabase do financeiro-v2 a cada 2 dias pra
evitar pause do free tier (que dorme após ~7 dias sem requests).
Idempotente: deleta workflow existente com mesmo nome antes de criar.
"""
import json, os, urllib.request, urllib.error

N8N_URL = "https://n8n-n8n.xktssy.easypanel.host"
N8N_KEY = os.environ["N8N_API_KEY"]
WORKFLOW_NAME = "INFRA | Supabase Keepalive"

SUPABASE_URL = "https://zageqyuwodvyxwohpugb.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZ2VxeXV3b2R2eXh3b2hwdWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTU5NTIsImV4cCI6MjA5MzEzMTk1Mn0.hpSav9X11Qq2wJMxOWFekHniJuHTgWZSUbwYhQfnKpM"

def n8n(method, path, body=None):
    req = urllib.request.Request(
        f"{N8N_URL}/api/v1{path}", method=method,
        headers={"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"},
        data=(json.dumps(body).encode() if body else None),
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}"); raise

def main():
    print("Procurando workflow existente...")
    lst = n8n("GET", "/workflows?limit=200")
    for w in [w for w in lst.get("data", []) if w["name"] == WORKFLOW_NAME]:
        print(f"  Deletando {w['id']}...")
        try: n8n("POST", f"/workflows/{w['id']}/deactivate")
        except Exception: pass
        n8n("DELETE", f"/workflows/{w['id']}")

    wf = {
        "name": WORKFLOW_NAME,
        "nodes": [
            {
                "id": "1",
                "name": "Cron a cada 2 dias",
                "type": "n8n-nodes-base.scheduleTrigger",
                "typeVersion": 1.2,
                "position": [240, 300],
                "parameters": {
                    "rule": {"interval": [{"field": "cronExpression", "expression": "0 12 */2 * *"}]}
                },
            },
            {
                "id": "2",
                "name": "Ping Supabase",
                "type": "n8n-nodes-base.httpRequest",
                "typeVersion": 4.2,
                "position": [460, 300],
                "parameters": {
                    "url": f"{SUPABASE_URL}/rest/v1/contas_bancarias?select=id&limit=1",
                    "method": "GET",
                    "sendHeaders": True,
                    "headerParameters": {"parameters": [
                        {"name": "apikey", "value": SUPABASE_ANON},
                        {"name": "Authorization", "value": f"Bearer {SUPABASE_ANON}"},
                    ]},
                    "options": {"timeout": 30000},
                },
            },
        ],
        "connections": {
            "Cron a cada 2 dias": {"main": [[{"node": "Ping Supabase", "type": "main", "index": 0}]]},
        },
        "settings": {"executionOrder": "v1"},
    }

    print(f"\nCriando '{WORKFLOW_NAME}'...")
    created = n8n("POST", "/workflows", wf)
    wf_id = created["id"]
    print(f"  ID: {wf_id}")
    n8n("POST", f"/workflows/{wf_id}/activate")
    print(f"\nOK. Roda 12:00 UTC dia sim/dia nao (cron '0 12 */2 * *').")

if __name__ == "__main__":
    main()

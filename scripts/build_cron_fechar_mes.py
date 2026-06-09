#!/usr/bin/env python3
"""
Cria/atualiza workflow n8n que roda diariamente às 23h BRT e fecha o mês
no /api/faturamento/fechar-mes do financeiro-v2 — mas só no último dia do mês.

Idempotente: deleta workflow existente com mesmo nome antes de criar.
"""
import json
import os
import sys
import urllib.request
import urllib.error

N8N_URL = "https://n8n-n8n.xktssy.easypanel.host"
N8N_KEY = os.environ["N8N_API_KEY"]
WORKFLOW_NAME = "FINANCEIRO V2 | Cron Fechar Mês"
CRON_SECRET = "fc4f93b08a7e6a553338e786d89c1aa3f2d8165b599f5e4b"
ENDPOINT = "https://caixa.brunotropolis.com.br/api/faturamento/fechar-mes"


def n8n(method, path, body=None):
    req = urllib.request.Request(
        f"{N8N_URL}/api/v1{path}",
        method=method,
        headers={"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"},
        data=(json.dumps(body).encode() if body else None),
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        raise


def main():
    # Deletar existente se houver
    print("Procurando workflow existente...")
    lst = n8n("GET", "/workflows?limit=200")
    existing = [w for w in lst.get("data", []) if w["name"] == WORKFLOW_NAME]
    for w in existing:
        print(f"  Deletando {w['id']}...")
        try:
            n8n("POST", f"/workflows/{w['id']}/deactivate")
        except Exception:
            pass
        n8n("DELETE", f"/workflows/{w['id']}")

    # Code node que decide se é último dia do mês BRT
    code = f"""
const agora = new Date();
// Ajusta pra BRT (UTC-3)
const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
const ano = brt.getUTCFullYear();
const mes = brt.getUTCMonth() + 1;
const dia = brt.getUTCDate();

// Último dia do mês em BRT
const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

const ehUltimoDia = dia === ultimoDia;
const mesRef = `${{ano}}-${{String(mes).padStart(2, '0')}}`;

return [{{
  json: {{
    eh_ultimo_dia: ehUltimoDia,
    mes_referencia: mesRef,
    dia,
    ultimo_dia: ultimoDia,
    timestamp_brt: brt.toISOString(),
  }}
}}];
"""

    wf = {
        "name": WORKFLOW_NAME,
        "nodes": [
            {
                "id": "1",
                "name": "Cron 23h BRT",
                "type": "n8n-nodes-base.scheduleTrigger",
                "typeVersion": 1.2,
                "position": [240, 300],
                "parameters": {
                    "rule": {
                        "interval": [
                            {"field": "cronExpression", "expression": "0 2 * * *"}
                        ]
                    }
                },
            },
            {
                "id": "2",
                "name": "Checar último dia",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [460, 300],
                "parameters": {"jsCode": code, "language": "javaScript"},
            },
            {
                "id": "3",
                "name": "É último dia?",
                "type": "n8n-nodes-base.if",
                "typeVersion": 2.2,
                "position": [680, 300],
                "parameters": {
                    "conditions": {
                        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                        "conditions": [
                            {
                                "id": "1",
                                "leftValue": "={{ $json.eh_ultimo_dia }}",
                                "rightValue": True,
                                "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                            }
                        ],
                        "combinator": "and",
                    }
                },
            },
            {
                "id": "4",
                "name": "Fechar mês",
                "type": "n8n-nodes-base.httpRequest",
                "typeVersion": 4.2,
                "position": [900, 240],
                "parameters": {
                    "url": ENDPOINT,
                    "method": "POST",
                    "sendHeaders": True,
                    "headerParameters": {
                        "parameters": [
                            {"name": "X-Cron-Secret", "value": CRON_SECRET},
                            {"name": "Content-Type", "value": "application/json"},
                        ]
                    },
                    "sendBody": True,
                    "specifyBody": "json",
                    "jsonBody": "={{ JSON.stringify({mes_referencia: $('Checar último dia').first().json.mes_referencia}) }}",
                    "options": {"timeout": 60000},
                },
            },
        ],
        "connections": {
            "Cron 23h BRT": {"main": [[{"node": "Checar último dia", "type": "main", "index": 0}]]},
            "Checar último dia": {"main": [[{"node": "É último dia?", "type": "main", "index": 0}]]},
            "É último dia?": {"main": [[{"node": "Fechar mês", "type": "main", "index": 0}], []]},
        },
        "settings": {"executionOrder": "v1"},
    }

    print(f"\nCriando '{WORKFLOW_NAME}'...")
    created = n8n("POST", "/workflows", wf)
    wf_id = created["id"]
    print(f"  ID: {wf_id}")

    print("Ativando...")
    n8n("POST", f"/workflows/{wf_id}/activate")
    print(f"\n✅ workflow ativo. Roda diariamente 02:00 UTC = 23:00 BRT.")
    print(f"   No último dia do mês, fecha automaticamente.")


if __name__ == "__main__":
    main()

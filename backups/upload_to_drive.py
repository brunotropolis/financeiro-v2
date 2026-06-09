#!/usr/bin/env python3
"""Cria workflow temp no n8n com Google Drive node + UPLOADA o XLSX + deleta."""
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

N8N_URL = "https://n8n-n8n.xktssy.easypanel.host"
N8N_KEY = os.environ["N8N_API_KEY"]
DRIVE_CRED_ID = "Fvnm9jPEeu3ZhToH"  # googleDriveOAuth2Api credencial existente

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
    xlsx_path = sys.argv[1]
    with open(xlsx_path, "rb") as f:
        data_b64 = base64.b64encode(f.read()).decode()

    filename = os.path.basename(xlsx_path)
    print(f"Uploading {filename} ({len(data_b64)} chars base64)")

    # Workflow temporário com:
    # - WEBHOOK (manual trigger via execute)
    # - Code node que injeta o binary do XLSX
    # - Google Drive node (upload)
    wf = {
        "name": "TEMP - Upload Financeiro Backup",
        "nodes": [
            {
                "id": "1", "name": "Webhook",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 2, "position": [240, 300],
                "parameters": {
                    "httpMethod": "POST", "path": "upload-fin-backup",
                    "responseMode": "lastNode"
                },
                "webhookId": "upload-fin-backup",
            },
            {
                "id": "2", "name": "DecodeBinary",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2, "position": [460, 300],
                "parameters": {
                    "language": "javaScript",
                    "jsCode": f"""
const b64 = {json.dumps(data_b64)};
const buffer = Buffer.from(b64, 'base64');
return [{{
  json: {{ filename: {json.dumps(filename)} }},
  binary: {{ data: {{ data: b64, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: {json.dumps(filename)}, fileExtension: 'xlsx' }} }}
}}];
"""
                },
            },
            {
                "id": "3", "name": "UploadDrive",
                "type": "n8n-nodes-base.googleDrive",
                "typeVersion": 3, "position": [680, 300],
                "credentials": {"googleDriveOAuth2Api": {"id": DRIVE_CRED_ID, "name": "drive"}},
                "parameters": {
                    "operation": "upload",
                    "name": filename,
                    "driveId": {"mode": "list", "value": "My Drive"},
                    "folderId": {"mode": "list", "value": "root"},
                    "options": {}
                },
            },
        ],
        "connections": {
            "Webhook": {"main": [[{"node": "DecodeBinary", "type": "main", "index": 0}]]},
            "DecodeBinary": {"main": [[{"node": "UploadDrive", "type": "main", "index": 0}]]},
        },
        "settings": {"executionOrder": "v1"},
    }

    print("1. Criando workflow temp...")
    created = n8n("POST", "/workflows", wf)
    wf_id = created["id"]
    print(f"   workflow id: {wf_id}")

    try:
        print("2. Ativando...")
        n8n("POST", f"/workflows/{wf_id}/activate")
        time.sleep(2)

        print("3. Disparando webhook...")
        webhook_url = f"{N8N_URL}/webhook/upload-fin-backup"
        req = urllib.request.Request(webhook_url, method="POST", data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            resp = r.read().decode()
            print(f"   response: {resp[:500]}")
            try:
                jresp = json.loads(resp)
                if isinstance(jresp, list) and jresp:
                    file = jresp[0]
                    fid = file.get("id")
                    link = file.get("webViewLink") or f"https://drive.google.com/file/d/{fid}/view"
                    print(f"\n✅ FILE: {file.get('name')}")
                    print(f"   ID: {fid}")
                    print(f"   LINK: {link}")
            except json.JSONDecodeError:
                pass
    finally:
        print(f"\n4. Deletando workflow temp {wf_id}...")
        try:
            n8n("POST", f"/workflows/{wf_id}/deactivate")
        except Exception:
            pass
        n8n("DELETE", f"/workflows/{wf_id}")
        print("   OK")

if __name__ == "__main__":
    main()

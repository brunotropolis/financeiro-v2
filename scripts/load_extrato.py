import sys, json, urllib.request, urllib.parse
from datetime import datetime
from parse_extrato_unicred import parse

BASE="https://zageqyuwodvyxwohpugb.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZ2VxeXV3b2R2eXh3b2hwdWdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1NTk1MiwiZXhwIjoyMDkzMTMxOTUyfQ.PD20LEBm3S2Hnbbjw1wMfJP7eA-ATINSEXu-QRx6hHY"
H={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"}
USER="a394c482-da14-4807-a94e-c67417681dd7"
CONTA={"94005":"d6873ac0-52e3-4647-af2b-cdd1fa32e787","169560":"e4598c53-6282-4b62-8551-9b228265230d"}

def req(method,path,body=None,extra=None):
    h=dict(H); h.update(extra or {})
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.Request(BASE+path,data=data,headers=h,method=method)
    resp=urllib.request.urlopen(r); raw=resp.read().decode()
    return json.loads(raw) if raw else None

def existing_hashes(conta_id):
    rows=req("GET",f"/movimentacoes_bancarias?select=bruto&conta_id=eq.{conta_id}&origem=eq.importacao_csv")
    return {r["bruto"].get("hash") for r in (rows or []) if r.get("bruto")}

rows_to_insert=[]
for path in [a for a in sys.argv[1:] if not a.startswith("--")]:
    r=parse(path); conta_id=CONTA[r["conta"]]
    seen=existing_hashes(conta_id)
    for l in r["linhas"]:
        if l["hash"] in seen: continue
        ta=l["tipo"]
        tipo = "transferencia" if ta=="interna" else ("entrada" if l["valor"]>0 else "saida")
        conciliado = ta in ("interna","greenn")
        rows_to_insert.append({
            "conta_id":conta_id,
            "tipo":tipo,
            "valor":abs(l["valor"]),
            "data":datetime.strptime(l["data"],"%d/%m/%Y").strftime("%Y-%m-%d"),
            "descricao":l["descricao"][:300],
            "origem":"importacao_csv",
            "conciliado":conciliado,
            "bruto":{"hash":l["hash"],"tipo_auto":ta,"contraparte":l["contraparte"],"valor_assinado":l["valor"]},
            "created_by":USER,"updated_by":USER,
        })

if not rows_to_insert:
    print("nada novo pra inserir (dedup)"); sys.exit(0)
res=req("POST","/movimentacoes_bancarias",rows_to_insert,{"Prefer":"return=representation"})
from collections import Counter
c=Counter(x["bruto"]["tipo_auto"] for x in rows_to_insert)
pend=sum(1 for x in rows_to_insert if not x["conciliado"])
print(f"inseridas {len(res)} movimentações | por tipo: {dict(c)}")
print(f"  -> {pend} PENDENTES de classificação | {len(rows_to_insert)-pend} auto-conciliadas (internas/greenn)")

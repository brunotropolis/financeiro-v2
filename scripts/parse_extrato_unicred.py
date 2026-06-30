# Parser de extrato Unicred (PDF) -> linhas + pré-classificação. Reutilizável (rotina Ter/Qui).
# Layout: descrição quebrada em volta da linha "DATA valor saldo". Reconciliação valida.
import re, sys, hashlib, json
import pdfplumber
from collections import Counter

OWN = ["MANUAL DO RECEM", "DREAM BABY", "MRN SERVICOS", "MRN SERVICOS DIGITAI"]
AMT = r'-?\s?R\$\s?[\d.]+,\d{2}'
ANCHOR = re.compile(r'^(\d{2}/\d{2}/\d{4})\s+(.*?)\s*('+AMT+r')\s+('+AMT+r')\s*$')

def money(s):
    neg = s.strip().startswith('-')
    num = s.split('R$')[1].strip().replace('.', '').replace(',', '.')
    return round(-float(num) if neg else float(num), 2)

def parse(path):
    with pdfplumber.open(path) as pdf:
        raw = "\n".join(p.extract_text() or "" for p in pdf.pages)
    raw = re.sub(r'[ \t]+', ' ', raw)
    conta = (re.search(r'Conta:\s*(\d+)', raw) or [None, None])[1]
    ini = re.search(r'Saldo em \d{2}/\d{2}/\d{4}:\s*R\$\s*([\d.]+,\d{2})', raw)
    fim = re.search(r'Saldo no final do per[ií]odo\s*R\$\s*([\d.]+,\d{2})', raw)
    saldo_ini = money("R$ "+ini.group(1)) if ini else None
    saldo_fim = money("R$ "+fim.group(1)) if fim else None
    lines = [l for l in raw.split("\n")]
    # corta rodapé de resumo
    for i, l in enumerate(lines):
        if "Saldo no final do per" in l:
            lines = lines[:i]; break
    out = []
    for i, l in enumerate(lines):
        m = ANCHOR.match(l.strip())
        if not m: continue
        data, middle, val, sal = m.group(1), m.group(2).strip(), m.group(3), m.group(4)
        if ")" in middle and "(" in middle:
            desc = middle
        else:
            prev = lines[i-1].strip() if i > 0 else ""
            nxt = lines[i+1].strip() if i+1 < len(lines) else ""
            if "Lançamentos" in prev or "Lan" in prev and "Valor" in prev: prev = ""
            desc = f"{prev} {middle} {nxt}".strip()
        desc = re.sub(r'\s+', ' ', desc)
        valor = money(val)
        cp = re.search(r'/\s*([^()/]+?)\s*\)', desc)
        contraparte = cp.group(1).strip() if cp else ''
        up = desc.upper()
        is_transf = any(k in up for k in ["TRANSFERENCIA", "TEF PIX", "DEB PIX"])
        if "GREENN" in up:
            tipo = "greenn"
        elif is_transf and any(o in up for o in OWN):
            tipo = "interna"
        elif valor > 0:
            tipo = "entrada"
        else:
            tipo = "gasto"
        h = hashlib.sha1(f"{conta}|{data}|{valor:.2f}|{desc}".encode()).hexdigest()[:16]
        out.append(dict(conta=conta, data=data, descricao=desc, contraparte=contraparte,
                        valor=valor, tipo=tipo, hash=h))
    return dict(conta=conta, saldo_ini=saldo_ini, saldo_fim=saldo_fim, linhas=out)

if __name__ == "__main__":
    emit = "--json" in sys.argv
    paths = [a for a in sys.argv[1:] if not a.startswith("--")]
    allrows=[]
    for path in paths:
        r = parse(path)
        soma = round(sum(l['valor'] for l in r['linhas']), 2)
        calc = round((r['saldo_ini'] or 0) + soma, 2)
        ok = abs(calc - (r['saldo_fim'] or 0)) < 0.01
        c = Counter(l['tipo'] for l in r['linhas'])
        allrows += r['linhas']
        if not emit:
            print(f"\n=== Conta {r['conta']} | {len(r['linhas'])} lançamentos ===")
            print(f"  saldo_ini {r['saldo_ini']} + soma {soma} = {calc} | saldo_fim {r['saldo_fim']} -> RECONCILIA: {'SIM' if ok else 'NAO ***'}")
            print(f"  tipos: {dict(c)}")
            print(f"  gastos a classificar (amostra):")
            for l in [x for x in r['linhas'] if x['tipo']=='gasto'][:8]:
                print(f"    {l['data']} R$ {l['valor']:>9.2f} | {l['contraparte'][:42]}")
    if emit:
        print(json.dumps(allrows, ensure_ascii=False))

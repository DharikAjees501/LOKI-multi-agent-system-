import requests

base = "http://localhost:8000/api"
endpoints = [
    "/scenarios",
    "/scenarios/scen-01/agents",
    "/scenarios/scen-8be620/agents",
    "/scenarios/scen-8be620/graph",
    "/agents?scenario_id=scen-01",
    "/agents?scenario_id=scen-8be620",
    "/reports/scen-8be620",
    "/feed?scenario_id=scen-8be620",
    "/feed?scenario_id=scen-01"
]

for ep in endpoints:
    try:
        r = requests.get(base + ep, timeout=2)
        print(f"{ep}: status={r.status_code}, length={len(r.text)}")
    except Exception as e:
        print(f"{ep}: error={e}")

"""茶文化 API 测试：详情 / 图谱 / 搜索（修复 JSON contains 在 Postgres 不可用的回归）。"""

from app.models import Tea, TeaPerson, TeaRegion


def _make_tea(db_session, **kw) -> Tea:
    defaults = dict(name="测试茶", category="绿茶", origin="浙江杭州")
    defaults.update(kw)
    tea = Tea(**defaults)
    db_session.add(tea)
    db_session.commit()
    return tea


def test_tea_detail_returns_related_people(db_session, client):
    tea = _make_tea(db_session, id=1)
    lu = TeaPerson(id=1, name="陆羽", dynasty="唐", related_tea_ids=["1"])
    zhao = TeaPerson(id=2, name="赵州", dynasty="唐", related_tea_ids=["2"])
    db_session.add_all([lu, zhao])
    db_session.commit()

    res = client.get("/api/culture/teas/1/detail")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "测试茶"
    people = body["people"]
    assert [p["name"] for p in people] == ["陆羽"]
    assert people[0]["dynasty"] == "唐"


def test_tea_detail_missing_returns_404(db_session, client):
    res = client.get("/api/culture/teas/999/detail")
    assert res.status_code == 404


def test_tea_graph_returns_nodes_and_edges(db_session, client):
    tea = _make_tea(db_session, id=1)
    region = TeaRegion(id=1, name="西湖产区", province="浙江")
    tea.region_id = 1
    db_session.add(region)
    db_session.commit()

    res = client.get("/api/culture/graph/1")
    assert res.status_code == 200
    body = res.json()
    assert {n["name"] for n in body["nodes"]} == {"测试茶", "西湖产区"}
    assert body["edges"] == [{"source": "tea_1", "target": "region_1", "relation": "产自"}]


def test_culture_search_matches_tea(db_session, client):
    _make_tea(db_session, name="西湖龙井")
    db_session.commit()

    res = client.get("/api/culture/search", params={"q": "龙井"})
    assert res.status_code == 200
    body = res.json()
    assert [t["name"] for t in body["teas"]] == ["西湖龙井"]

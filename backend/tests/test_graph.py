import pytest
from app.services.extraction_service import extraction_service
from app.services.graph_service import graph_service
from app.models.graph import GraphRAGOutput

def test_graphrag_json_validation():
    chunk_text = "Enterprise pricing strategy impacts mid-market customers."
    rag_out = extraction_service.extract_graph_from_chunk(chunk_text, chunk_index=1)
    assert isinstance(rag_out, GraphRAGOutput)
    assert len(rag_out.entities) >= 1
    assert len(rag_out.relationships) >= 1
    assert rag_out.entities[0].source_chunk == 1

def test_networkx_graph_creation():
    scenario_id = "test-scen-01"
    doc_id = "doc-test"
    rag_out = extraction_service.extract_graph_from_chunk("Pricing change causes churn risk.")

    graph_res = graph_service.populate_scenario_graph_from_rag(scenario_id, doc_id, [rag_out])
    assert graph_res.scenario_id == scenario_id
    assert len(graph_res.nodes) >= 1
    assert len(graph_res.edges) >= 1
    assert graph_res.nodes[0].source_chunk is not None

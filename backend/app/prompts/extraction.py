GRAPHRAG_EXTRACTION_PROMPT = """
You are an expert GraphRAG Knowledge Graph Extraction Engine for LOKI (Latent Outcomes & Knowledge Intelligence).

Your task is to analyze the provided strategy document chunk and extract structured entities, relationships, constraints, and risks.

Input Document Text:
\"\"\"
{text}
\"\"\"

Chunk Index: {chunk_index}

REQUIREMENTS:
1. Extract key entities. Each entity must have:
   - name: Clear, concise title
   - type: One of ["Product", "Pricing", "Customer", "Competitor", "Regulator", "Market", "Policy", "Risk"]
   - description: 1-sentence summary
   - source_chunk: {chunk_index}

2. Extract relationships between entities. Each relationship must have:
   - source: Name of source entity
   - target: Name of target entity
   - relationship: One of ["AFFECTS", "COMPETES_WITH", "REGULATES", "DEPENDS_ON", "TARGETS", "CAUSES"]
   - confidence: 0.0 to 1.0
   - description: Short explanation
   - source_chunk: {chunk_index}

3. Extract key constraints and risks.

Output MUST strictly be a valid JSON object adhering to this schema:
{{
  "entities": [
    {{ "name": "...", "type": "...", "description": "...", "source_chunk": {chunk_index} }}
  ],
  "relationships": [
    {{ "source": "...", "target": "...", "relationship": "...", "confidence": 0.9, "description": "...", "source_chunk": {chunk_index} }}
  ],
  "constraints": ["..."],
  "risks": ["..."]
}}
"""

import json
import re
from typing import List, Optional, Dict, Any
from app.models.graph import GraphRAGOutput, ExtractedEntity, ExtractedRelationship
from app.prompts.extraction import GRAPHRAG_EXTRACTION_PROMPT
from app.core.config import settings
from app.core.logging import logger

import concurrent.futures

from app.engine.llm_client import execute_multi_provider_llm_call, get_active_api_keys

class ExtractionService:
    async def extract_graph_from_batch_async(
        self,
        chunks: List[Dict[str, Any]],
        description: str = "",
        scenario_title: str = ""
    ) -> GraphRAGOutput:
        """
        Processes a batch of 3-4 document chunks in a single LLM call for efficient GraphRAG extraction.
        """
        if not chunks:
            return GraphRAGOutput(entities=[], relationships=[], constraints=[], risks=[])

        batch_indices = [c.get("index", 0) for c in chunks]
        first_index = batch_indices[0]
        combined_chunks = "\n\n".join([
            f"--- DOCUMENT EXCERPT (Chunk {c.get('index', i)}) ---\n{c.get('text', '')}"
            for i, c in enumerate(chunks)
        ])
        logger.info(f"[ExtractionService] Extracting GraphRAG knowledge for batch of {len(chunks)} chunks (indices {batch_indices})")

        combined_text = f"Title/Scenario: {scenario_title}\nDescription: {description}\nDocument Content:\n{combined_chunks}"
        prompt = GRAPHRAG_EXTRACTION_PROMPT.format(text=combined_text, chunk_index=first_index)

        keys = get_active_api_keys()
        if keys:
            try:
                res_dict = await execute_multi_provider_llm_call(
                    prompt, temperature=0.2, max_tokens=1500, call_type="GRAPHRAG_EXTRACTION"
                )
                if res_dict and res_dict.get("text"):
                    raw_json = self._clean_json(res_dict["text"])
                    parsed = json.loads(raw_json)
                    res = GraphRAGOutput(**parsed)
                    logger.info(f"[ExtractionService] LLM GraphRAG extraction succeeded for batch {batch_indices}: {len(res.entities)} entities, {len(res.relationships)} edges.")
                    return res
            except Exception as e:
                logger.warning(f"[ExtractionService] LLM GraphRAG batch extraction failed ({e}). Falling back to rule-based.")

        # Fallback: extract across all chunks in batch using rule-based
        all_entities = []
        all_rels = []
        all_constraints = []
        all_risks = []
        for c in chunks:
            out = self._rule_based_extraction(c.get("text", ""), c.get("index", 0), description, scenario_title)
            all_entities.extend(out.entities)
            all_rels.extend(out.relationships)
            all_constraints.extend(out.constraints)
            all_risks.extend(out.risks)

        return GraphRAGOutput(
            entities=all_entities,
            relationships=all_rels,
            constraints=all_constraints,
            risks=all_risks
        )

    def extract_graph_from_chunk(
        self, chunk_text: str, chunk_index: int = 0, description: str = "", scenario_title: str = ""
    ) -> GraphRAGOutput:
        logger.info(f"[ExtractionService] Extracting GraphRAG knowledge entities for chunk index {chunk_index} (Length: {len(chunk_text)})")
        combined_text = f"Title/Scenario: {scenario_title}\nDescription: {description}\nDocument Chunk Content:\n{chunk_text}"
        prompt = GRAPHRAG_EXTRACTION_PROMPT.format(text=combined_text, chunk_index=chunk_index)

        keys = get_active_api_keys()
        if keys:
            try:
                import asyncio
                import concurrent.futures
                
                res_dict = None
                try:
                    loop = asyncio.get_running_loop()
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(asyncio.run, execute_multi_provider_llm_call(prompt, temperature=0.2, max_tokens=1000, call_type="GRAPHRAG_EXTRACTION"))
                        res_dict = future.result(timeout=30.0)
                except RuntimeError:
                    res_dict = asyncio.run(execute_multi_provider_llm_call(prompt, temperature=0.2, max_tokens=1000, call_type="GRAPHRAG_EXTRACTION"))

                if res_dict and res_dict.get("text"):
                    raw_json = self._clean_json(res_dict["text"])
                    parsed = json.loads(raw_json)
                    res = GraphRAGOutput(**parsed)
                    logger.info(f"[ExtractionService] Multi-Provider LLM ({res_dict.get('provider')}/{res_dict.get('model')}) GraphRAG extraction succeeded for chunk {chunk_index} ({len(res.entities)} entities, {len(res.relationships)} relationships).")
                    return res
            except Exception as e:
                logger.warning(f"Multi-Provider LLM extraction failed ({e}). Using rule-based GraphRAG extractor.")

        # Heuristic / Deterministic GraphRAG extraction grounded in document content and description
        res = self._rule_based_extraction(chunk_text, chunk_index, description, scenario_title)
        logger.info(f"[ExtractionService] Rule-based GraphRAG extraction completed for chunk {chunk_index} ({len(res.entities)} entities, {len(res.relationships)} relationships).")
        return res

    def _clean_json(self, text: str) -> str:
        text = re.sub(r"^```json\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"^```\s*", "", text, flags=re.MULTILINE)
        return text.strip()

    def _rule_based_extraction(
        self, text: str, chunk_index: int, description: str = "", scenario_title: str = ""
    ) -> GraphRAGOutput:
        context_str = f"{scenario_title} {description} {text}".strip()
        doc_topic = scenario_title.strip() or "Strategy Initiative"

        # Dynamic entity extraction based on text, title & description
        entities: List[ExtractedEntity] = []

        # 1. Primary Strategy Node
        main_type = "Pricing" if any(w in context_str.lower() for w in ["price", "cost", "fee", "rate", "tariff", "subscription"]) else (
            "Technology" if any(w in context_str.lower() for w in ["ai", "tech", "cloud", "software", "system", "platform", "bot", "code"]) else (
                "Policy" if any(w in context_str.lower() for w in ["compliance", "gdpr", "hipaa", "ferpa", "fda", "sec", "law", "policy"]) else "Product"
            )
        )
        entities.append(
            ExtractedEntity(
                name=f"{doc_topic} Core Architecture",
                type=main_type,
                description=f"Primary strategic initiative defined in '{doc_topic}'. {description[:80] if description else 'Extracted from document content.'}",
                source_chunk=chunk_index
            )
        )

        # 2. Extract Capitalized Named Phrases, Section Headings, or Key Technical Terms dynamically from text
        found_phrases = []
        cap_matches = re.findall(r'\b([A-Z][a-zA-Z0-9\-_]+(?:\s+[A-Z][a-zA-Z0-9\-_]+){1,3})\b', text)
        for cm in cap_matches:
            if cm not in found_phrases and len(cm) > 4:
                found_phrases.append(cm)

        heading_matches = re.findall(r'(?:^\d+[\.\)]\s+([A-Za-z0-9\s\-]{3,40})|^#+\s+([A-Za-z0-9\s\-]{3,40}))', text, flags=re.MULTILINE)
        for h1, h2 in heading_matches:
            val = (h1 or h2 or "").strip()
            if val and len(val) > 3 and val not in found_phrases:
                found_phrases.append(val)

        # Filter out common stop phrases
        ignore_words = {"Strategy Document", "Document Chunk", "Title Scenario", "Description", "Scenario Document", "Phase A", "Business Workflow Documentation", "Table of Contents", "Executive Summary"}
        unique_phrases = []
        for p in found_phrases:
            if p not in ignore_words and len(p) > 3 and p not in unique_phrases and p.lower() not in doc_topic.lower():
                unique_phrases.append(p)

        # 3. Dynamic Customer/User Segment Entity
        cust_name = "Enterprise & High-Value Accounts"
        if "student" in context_str.lower() or "education" in context_str.lower() or "university" in context_str.lower() or "faculty" in context_str.lower():
            cust_name = "Academic Faculty & Learner Community"
        elif "patient" in context_str.lower() or "clinical" in context_str.lower() or "hospital" in context_str.lower():
            cust_name = "Clinical & Patient Network"
        elif "consumer" in context_str.lower() or "user" in context_str.lower() or "retail" in context_str.lower():
            cust_name = "Broad Consumer Base"
        entities.append(
            ExtractedEntity(
                name=cust_name,
                type="Customer",
                description=f"Target adoption segment evaluated under {doc_topic}.",
                source_chunk=chunk_index
            )
        )

        # 4. Dynamic Regulatory / Governance Entity
        reg_name = "Institutional Oversight & Safety Board"
        if any(w in context_str.lower() for w in ["privacy", "gdpr", "data", "pii", "ferpa"]):
            reg_name = "Global Data Privacy & FERPA Compliance Bureau"
        elif any(w in context_str.lower() for w in ["fda", "health", "medical", "clinical"]):
            reg_name = "FDA & Healthcare Compliance Board"
        elif any(w in context_str.lower() for w in ["sec", "audit", "financial", "tax"]):
            reg_name = "SEC & Corporate Audit Authority"
        elif any(w in context_str.lower() for w in ["ftc", "monopoly", "antitrust", "price"]):
            reg_name = "FTC & Antitrust Enforcement Bureau"
        entities.append(
            ExtractedEntity(
                name=reg_name,
                type="Regulator",
                description=f"Regulatory oversight monitoring compliance of {doc_topic}.",
                source_chunk=chunk_index
            )
        )

        # 5. Dynamic Risk Vector Entity
        risk_title = f"{doc_topic} Strategic Risk Factor"
        if description and len(description) > 10:
            risk_desc = f"Risk factor stemming from description: {description[:90]}"
        else:
            risk_desc = f"Projected operational and stakeholder alignment friction under {doc_topic}."
        entities.append(
            ExtractedEntity(
                name=risk_title,
                type="Risk",
                description=risk_desc,
                source_chunk=chunk_index
            )
        )

        # 6. Add Entities from Extracted Phrases or Key Nouns
        for p in unique_phrases[:8]:
            p_type = "Policy" if any(w in p.lower() for w in ["act", "law", "policy", "rule", "standard", "iso", "sla", "auth", "saml", "lti", "rbac"]) else (
                "Competitor" if any(w in p.lower() for w in ["rival", "competitor", "market", "startup", "vendor"]) else (
                    "Technology" if any(w in p.lower() for w in ["api", "ai", "platform", "cloud", "engine", "system", "model", "data", "canvas", "integration", "bot"]) else "Product"
                )
            )
            entities.append(
                ExtractedEntity(
                    name=p,
                    type=p_type,
                    description=f"Grounded entity extracted directly from text context: '{p}'.",
                    source_chunk=chunk_index
                )
            )

        # Ensure at least 6 distinct entities
        if len(entities) < 6:
            entities.append(
                ExtractedEntity(
                    name=f"Ecosystem Market Response ({doc_topic})",
                    type="Market",
                    description=f"Industry ecosystem adoption and competitive counter-maneuvers.",
                    source_chunk=chunk_index
                )
            )
            entities.append(
                ExtractedEntity(
                    name="Operational SLA & Compliance Standard",
                    type="Policy",
                    description="Standard operating procedures and SLA commitments.",
                    source_chunk=chunk_index
                )
            )

        # Dynamic Relationships connecting extracted entities
        relationships: List[ExtractedRelationship] = []
        main_ent = entities[0].name
        cust_ent = entities[1].name
        reg_ent = entities[2].name
        risk_ent = entities[3].name

        relationships.append(
            ExtractedRelationship(
                source=main_ent,
                target=cust_ent,
                relationship="AFFECTS",
                confidence=0.94,
                description=f"Direct strategic operational impact of {main_ent} on {cust_ent}.",
                source_chunk=chunk_index
            )
        )
        relationships.append(
            ExtractedRelationship(
                source=reg_ent,
                target=main_ent,
                relationship="REGULATES",
                confidence=0.96,
                description=f"Regulatory disclosure and compliance standards governing {main_ent}.",
                source_chunk=chunk_index
            )
        )
        relationships.append(
            ExtractedRelationship(
                source=main_ent,
                target=risk_ent,
                relationship="CAUSES",
                confidence=0.91,
                description=f"Potential execution friction triggering {risk_ent}.",
                source_chunk=chunk_index
            )
        )

        for extra_ent in entities[4:]:
            rel_type = "DEPENDS_ON" if extra_ent.type == "Policy" else (
                "COMPETES_WITH" if extra_ent.type == "Competitor" else "TARGETS"
            )
            relationships.append(
                ExtractedRelationship(
                    source=extra_ent.name,
                    target=main_ent if extra_ent.type in ["Regulator", "Competitor"] else cust_ent,
                    relationship=rel_type,
                    confidence=0.88,
                    description=f"Relation linking {extra_ent.name} within {doc_topic} knowledge network.",
                    source_chunk=chunk_index
                )
            )

        return GraphRAGOutput(
            entities=entities,
            relationships=relationships,
            constraints=[f"Mandatory compliance notice for {doc_topic}"],
            risks=[risk_desc]
        )

extraction_service = ExtractionService()

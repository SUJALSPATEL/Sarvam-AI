# Hybrid Semantic Token Diff Level Algorithm

**Subtitle:**  
*A streaming-aware token comparison algorithm optimized for conversational LLM outputs.*

---

<div align="center">
  <img src="./public/screenshot2.png" alt="Sarvam AI Diff Viewer" width="800" />
  <p><em>Diff Viewer Tab</em></p>
</div>

---

## 1. Motivation

Traditional text diff systems were engineered for source code, version control, and static documents. In those domains, calculating the absolute minimal edit distance across an entire file is paramount, even if the resulting changeset visually splinters individual words or reorganizes punctuation in non-intuitive ways.

Conversational Large Language Model (LLM) outputs present an entirely different set of constraints:
* **Streaming-Friendly Comparison:** Responses arrive over the network chunk-by-chunk; diffs must be rendered progressively without waiting for the final token.
* **Readable Token Evolution:** Language models frequently rephrase sentences, inject synonyms, or restructure paragraphs. Visualizing these shifts requires semantic continuity, not strict mathematical minimization.
* **Human-Readable Differences:** The primary consumer is a human evaluating AI model drift, meaning the diff must read naturally, resembling a copyeditor's revisions rather than a Git merge conflict.

The Hybrid Semantic Token Diff Level Algorithm was designed specifically for real-time conversational AI comparison, solving the UX challenges inherent in streaming model evaluation.

---

## 2. Why Traditional Diff Algorithms Were Avoided

While standard diffing algorithms are foundational to computer science and excellent for traditional text, they are fundamentally mismatched for live LLM response streams. We intentionally avoided standard approaches for the following reasons:

### LCS (Longest Common Subsequence)
LCS relies on a global dynamic programming matrix to compute differences. 
* **Cost of Recomputation:** Calculating a global matrix is highly expensive during streaming, as every new incoming token requires a full recomputation of the sequence.
* **Conversational Degradation:** LCS rigidly aligns character sequences, frequently matching unrelated linguistic structures (e.g., aligning the "th" in "there" with the "th" in "the"), resulting in poor readability for token shifts.

### Myers Diff Algorithm
The Myers algorithm is heavily optimized to produce the mathematically minimal edit script.
* **Source Control Bias:** It is brilliant for version control, where minimizing line additions/deletions is critical.
* **Unsuitable for Streaming AI:** When applied to streamed generative text, the pursuit of a minimal edit script often shatters words into disjointed fragments, significantly degrading the user's reading experience.

*Note: These algorithms remain industry standards for static file comparison. Our decision to avoid them stems entirely from our prioritization of conversational readability and streaming UI stability.*

---

## 3. Design Goals

The core engineering objectives for this algorithm were focused on the end-user experience of observing two models generating text simultaneously:
* **Streaming Compatibility:** Ensure smooth UI rendering as tokens arrive over Server-Sent Events (SSE).
* **Low Recomputation Overhead:** Avoid global re-evaluations for every incoming chunk.
* **Readable Token Alignment:** Keep words whole and phrases intact.
* **Conversational Coherence:** Reflect natural human language revisions.
* **Progressive Updates:** Lock matched tokens quickly to stabilize the DOM.
* **Human-Friendly Diffs:** Prioritize visual cleanliness over mathematical minimality.

---

## 4. Core Algorithm Overview

The system processes incoming data via a highly localized, forward-moving pipeline:

```text
Response Stream A & B
        ↓
Tokenization Strategy
        ↓
Local Window Matching
        ↓
Similarity Scoring
        ↓
Greedy Alignment
        ↓
Token Classification
        ↓
React UI Visualization
```

---

## 5. Tokenization Strategy

Instead of character-by-character comparison, the input streams are parsed into semantic tokens. Token boundaries are strictly defined to respect natural language:

* **Words:** Standard alphanumeric sequences (e.g., `["artificial", "intelligence"]`).
* **Punctuation:** Kept as distinct tokens to prevent false merges (e.g., `[",", ".", "!"]`).
* **Whitespace/Newlines:** Explicitly tracked to maintain structural alignment across paragraphs.

*Example:*  
Input: `Hello, world!`  
Tokens: `["Hello", ",", " ", "world", "!"]`

---

## 6. Windowed Token Alignment

Instead of analyzing the entire document, the algorithm employs a local sliding-window approach.

When searching for a match for a newly arrived token, the engine only searches a limited, forward-looking window (e.g., the next $N$ tokens). 
* **Nearby Token Searching:** Limits O(N) scans to a localized horizon.
* **Local Contextual Continuity:** Prevents the algorithm from inappropriately matching a common word (like "and") to an instance 4 paragraphs away.

This significantly improves conversational stability by preventing layout jumps and reduces the latency of streamed updates.

---

## 7. Similarity Scoring

Token matches are not strictly binary. The engine employs custom scoring heuristics to determine alignment viability:

* **Exact Match:** Highest weight (e.g., `Hello` == `Hello`).
* **Case-Insensitive Match:** High weight (e.g., `Hello` == `hello`).
* **Punctuation Variation:** Moderate weight (e.g., `world` == `world,`).
* **Contextual Similarity:** Boosts scores if surrounding tokens also align.

By using tiered similarity scoring, the algorithm prioritizes conversational readability and semantic matching over mathematically minimal edits.

---

## 8. Greedy Contextual Matching

Once a high-confidence similarity score is achieved within the sliding window, the algorithm employs **local greedy alignment**.

* **Progressive Matching:** As soon as a match is verified, the alignment is locked.
* **Preserving Flow Continuity:** Locked tokens serve as anchor points for the next window iteration.

This "lock-and-move" approach is perfectly suited for streamed AI responses, as it prevents historical diff states from flickering or recalculating wildly as new tokens are appended to the stream.

---

## 9. Token Classification

Upon alignment, tokens are classified into rendering states that map directly to our CSS visualization layer:

* **Unchanged:** Present in both streams (rendered with standard opacity).
* **Inserted:** Present only in the new model's output (rendered in green/highlighted).
* **Modified:** Semantic shift detected (rendered with distinct visual tags).
* **Deleted:** Present in the baseline but removed in the new output (rendered in red/strikethrough).

---

## 10. Streaming Compatibility

This algorithm was architected from the ground up for **streamed token generation**. 

Because LLM inferences arrive unpredictably in variable-sized chunks, a standard diff engine would trigger an O(N²) global recomputation on every frame, stalling the UI thread. 

The Hybrid Semantic Token Diff approach:
* Demands **no expensive global recomputation**.
* Provides **stable progressive updates** that can be flushed to the DOM seamlessly via React `requestAnimationFrame`.
* Ensures significantly **smoother UI rendering** by isolating computations to the trailing edge of the generation stream.

---

## 11. Complexity Analysis

By discarding the global dynamic programming matrix in favor of window-constrained local matching, the computational overhead is drastically reduced.

* **Average-Case Behavior:** Approaches O(N * W), where `N` is the token count and `W` is the constrained window size, rather than traditional O(N²).
* **Streaming Efficiency:** Only newly arrived tokens in the delta are evaluated against the current window, meaning per-frame execution time remains constant regardless of document length.
* **Localized Comparison Cost:** Memory allocation is constrained to the active sliding window, preventing heap bloat during long conversational sessions.

---

## 12. Tradeoffs

Engineering requires acknowledging tradeoffs. This algorithm is highly specialized, meaning it concedes certain general-purpose capabilities:

* **Not Mathematically Optimal:** It will occasionally miss complex, multi-paragraph transpositions that a global LCS would catch.
* **Sacrifices Global Edit Optimality:** Prioritizing streaming stability means once an alignment is aggressively locked, the engine will not backtrack to find a theoretically "better" match if one appears much later.
* **Highly Specialized:** It is uniquely tuned for conversational UX, meaning it would perform poorly as a diff tool for raw source code.

---

## 13. Why This Works Well for LLMs

LLM outputs evolve progressively and conversationally. They are not entirely rewritten from scratch on every tick; they append text with inherent semantic continuity.

Our algorithm leverages this behavior. Because generative models append sequential ideas, a localized, greedy, sliding-window approach perfectly captures the nature of evolving text. It excels at preserving partial outputs and visualizes semantic drift exactly how human evaluators prefer to read it.

---

## 14. Comparison Against Traditional Approaches

| Feature | LCS | Myers Diff | **Hybrid Semantic Token Diff Level** |
| :--- | :--- | :--- | :--- |
| **Streaming Friendliness** | Low | Low | **High** |
| **Conversational Readability** | Poor | Moderate | **Excellent** |
| **Local Stability** | Low (Flickers) | Moderate | **High (Locked Anchors)** |
| **Recomputation Cost** | O(N²) | O(ND) | **O(N * W)** |
| **Source-Code Optimization** | Excellent | Excellent | Poor |
| **AI-Response Optimization** | Poor | Poor | **Excellent** |

---

## 15. Future Improvements

As the infrastructure scales, the diff engine can be expanded with:
* **Semantic Embeddings:** Using lightweight local embedding models to align tokens based on meaning rather than string similarity.
* **Token Confidence Weighting:** Integrating logprobs from the LLM to highlight areas of model uncertainty during diffing.
* **Adaptive Windows:** Dynamically resizing the sliding window based on the current T/s (Tokens per Second) throughput velocity.
* **Semantic Clustering:** Grouping modified tokens into broader ideational shifts for summary-level diffs.

---

## 16. Summary

The Hybrid Semantic Token Diff Level Algorithm is not a general-purpose text comparison tool. It is a highly specialized piece of AI infrastructure intentionally designed for streamed conversational systems.

By abandoning the rigid constraints of traditional static document diffing, we have achieved a real-time, low-latency engine that prioritizes human-readable token evolution and guarantees a responsive, production-grade UX during live model inference.

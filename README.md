# arXiv Preprint Tracker — New Papers by Keyword/Category

Track new research preprints on arXiv by keyword and/or category. Get
the title, authors, abstract, category, and PDF link the moment a paper
is submitted.

Built for researchers, VCs tracking a technical trend, and anyone who
wants to know what's new in a field without checking arXiv by hand
every morning.

## Input

```json
{
  "keyword": "prompt injection",
  "category": "cs.AI",
  "daysBack": 7,
  "maxResults": 25
}
```

| Field | Type | Description |
|---|---|---|
| `keyword` | string (optional) | Free-text search across title and abstract. |
| `category` | string (optional) | arXiv category code, e.g. `"cs.AI"`, `"cs.CL"`, `"stat.ML"`, `"econ.GN"`, `"q-bio.GN"`. Full list at arxiv.org/category_taxonomy. |
| `daysBack` | number | How many days back from today to search, by submission date. Default `7`, max `90`. |
| `maxResults` | number | Max papers to return, most recently submitted first. Default `25`, max `100`. |

Leave both `keyword` and `category` blank to get the most recently
submitted papers across all of arXiv.

## Output

One record per paper:

```json
{
  "arxivId": "2608.12172v1",
  "title": "Rethinking Agent Security as a Networking Problem",
  "summary": "AI agents are rapidly becoming more capable and widely deployed...",
  "authors": ["Van Tran", "Taveesh Sharma", "Tajveer Singh Dhesi", "Nick Feamster"],
  "primaryCategory": "cs.MA",
  "categories": ["cs.MA"],
  "published": "2026-08-12T15:29:51Z",
  "updated": "2026-08-12T15:29:51Z",
  "comment": null,
  "journalRef": null,
  "doi": null,
  "absUrl": "http://arxiv.org/abs/2608.12172v1",
  "pdfUrl": "https://arxiv.org/pdf/2608.12172v1"
}
```

A search with no matching papers returns no items but is still billed
once for the search.

## How it works

Direct calls to the official [arXiv API](https://info.arxiv.org/help/api/index.html)
(`export.arxiv.org`) — no proxy, no key, no scraping. Free and open,
arXiv explicitly does not require API key registration.

## Pricing note

Billed per **search**, not per paper returned — one charge whether the
search returns 0 papers or 100.

## Related products

- [PubMed Research Alert](https://github.com/timmKal01/pubmed-research-alert) — the biomedical/life-science equivalent, via NCBI E-utilities instead of arXiv

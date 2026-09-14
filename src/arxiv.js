import * as cheerio from 'cheerio';

const BASE_URL = 'https://export.arxiv.org/api/query';

function toArxivDate(date) {
    const iso = date.toISOString();
    const datePart = iso.slice(0, 10).replace(/-/g, '');
    const timePart = iso.slice(11, 16).replace(':', '');
    return `${datePart}${timePart}`;
}

function buildSearchQuery({ keyword, category, startDate, endDate }) {
    const parts = [];
    if (keyword) parts.push(`all:"${keyword}"`);
    if (category) parts.push(`cat:${category}`);
    parts.push(`submittedDate:[${toArxivDate(startDate)} TO ${toArxivDate(endDate)}]`);
    return parts.join(' AND ');
}

const MAX_ATTEMPTS = 9;
const MAX_BACKOFF_MS = 60_000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * arXiv has enforced its documented rate limit more strictly since ~Feb 2026
 * (public reports of 429s across many client tools, not specific to this
 * actor). Confirmed empirically that Apify's shared cloud egress IP hits
 * this much harder than an ordinary residential IP — a single request can
 * still 429 after ~18s of backoff on Apify's infra, presumably because many
 * other tenants' actors/scripts share the same egress range and collectively
 * exceed arXiv's per-IP budget. Retry with a wider budget rather than
 * failing outright; same defensive pattern already used for crt.sh
 * (certificate-transparency-monitor) and the Launch Library API
 * (rocket-launch-tracker) elsewhere in this portfolio, just sized larger
 * because this source's block empirically outlasts a short backoff.
 *
 * Real bug found and fixed 2026-09-14: this function only ever checked
 * res.status after a successful fetch() — it never caught fetch() itself
 * throwing. A real production run failed with a raw ConnectTimeoutError
 * (fetch() rejected before any response existed, not a 429), which
 * propagated straight out and crashed the run on the very first attempt,
 * completely bypassing the retry budget above no matter how generous it
 * was. Wrap the fetch call in try/catch and treat a thrown network error
 * the same as a 429/5xx: retry it, don't let it skip the loop entirely.
 * Also capped each individual backoff at 60s — a single large `retry-after`
 * value should still count against the attempt budget, not stall one step
 * indefinitely.
 */
async function fetchWithRetry(url) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let res;
        try {
            res = await fetch(url, { headers: { Connection: 'close' } });
        } catch (err) {
            lastError = new Error(`arXiv request errored: ${err.message}`);
            if (attempt < MAX_ATTEMPTS) {
                const jitterMs = Math.floor(Math.random() * 2000);
                await sleep(Math.min(attempt * 6000 + jitterMs, MAX_BACKOFF_MS));
                continue;
            }
            throw lastError;
        }
        if (res.ok) return res;

        if (res.status === 429 || res.status >= 500) {
            lastError = new Error(`arXiv API request failed: ${res.status} ${res.statusText}`);
            if (attempt < MAX_ATTEMPTS) {
                const retryAfterSecs = Number(res.headers.get('retry-after'));
                const jitterMs = Math.floor(Math.random() * 2000);
                const backoffMs = Number.isFinite(retryAfterSecs) && retryAfterSecs > 0
                    ? retryAfterSecs * 1000 + jitterMs
                    : attempt * 6000 + jitterMs;
                await sleep(Math.min(backoffMs, MAX_BACKOFF_MS));
                continue;
            }
            throw lastError;
        }

        throw new Error(`arXiv API request failed: ${res.status} ${res.statusText}`);
    }
    throw lastError;
}

export async function fetchPapers({ keyword, category, startDate, endDate, maxResults }) {
    const url = new URL(BASE_URL);
    url.searchParams.set('search_query', buildSearchQuery({ keyword, category, startDate, endDate }));
    url.searchParams.set('sortBy', 'submittedDate');
    url.searchParams.set('sortOrder', 'descending');
    url.searchParams.set('max_results', String(maxResults));

    const res = await fetchWithRetry(url);
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    return $('entry')
        .map((_, el) => {
            const $el = $(el);
            const absUrl = $el.find('id').first().text().trim();
            const arxivId = absUrl.split('/abs/')[1] ?? absUrl;
            const pdfUrl = $el
                .find('link')
                .filter((__, link) => $(link).attr('title') === 'pdf')
                .attr('href');

            return {
                arxivId,
                title: $el.find('title').first().text().trim().replace(/\s+/g, ' '),
                summary: $el.find('summary').first().text().trim().replace(/\s+/g, ' '),
                authors: $el
                    .find('author')
                    .map((__, a) => $(a).find('name').text().trim())
                    .get(),
                primaryCategory: $el.find('arxiv\\:primary_category').attr('term') ?? null,
                categories: $el
                    .find('category')
                    .map((__, c) => $(c).attr('term'))
                    .get(),
                published: $el.find('published').first().text().trim(),
                updated: $el.find('updated').first().text().trim(),
                comment: $el.find('arxiv\\:comment').first().text().trim() || null,
                journalRef: $el.find('arxiv\\:journal_ref').first().text().trim() || null,
                doi: $el.find('arxiv\\:doi').first().text().trim() || null,
                absUrl,
                pdfUrl: pdfUrl ?? null,
            };
        })
        .get();
}

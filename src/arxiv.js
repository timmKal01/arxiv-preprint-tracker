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

export async function fetchPapers({ keyword, category, startDate, endDate, maxResults }) {
    const url = new URL(BASE_URL);
    url.searchParams.set('search_query', buildSearchQuery({ keyword, category, startDate, endDate }));
    url.searchParams.set('sortBy', 'submittedDate');
    url.searchParams.set('sortOrder', 'descending');
    url.searchParams.set('max_results', String(maxResults));

    const res = await fetch(url, { headers: { Connection: 'close' } });
    if (!res.ok) {
        throw new Error(`arXiv API request failed: ${res.status} ${res.statusText}`);
    }
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

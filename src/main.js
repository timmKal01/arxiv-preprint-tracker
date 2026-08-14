import { Actor, log } from 'apify';
import { fetchPapers } from './arxiv.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { keyword, category, daysBack = 7, maxResults = 25 } = input;

/** Must match the event name configured in this Actor's pay-per-event pricing on Apify. */
const PAPER_SEARCH_EVENT = 'paper-search';

const endDate = new Date();
const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

const papers = await fetchPapers({
    keyword,
    category,
    startDate,
    endDate,
    maxResults: Math.min(maxResults, 100),
});

for (const paper of papers) {
    await Actor.pushData(paper);
}

await Actor.charge({ eventName: PAPER_SEARCH_EVENT });

log.info(`Pushed ${papers.length} paper(s)`);

await Actor.exit();

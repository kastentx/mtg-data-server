import express from 'express';
import asyncHandler from 'express-async-handler';
import CardDataStore from '../store/cardData';
import { CardSet } from '../types';
import { getPriceHistoryByUuid, getPriceHistoryByUuids } from '../database/db';
import { calculateMovingAverages } from '../utils/priceMath';

const router = express.Router();

/**
 * Get cards by set codes
 */
router.post('/set-code', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const setCodesList = req.body.setCodes as string[];
    
    if (!setCodesList || !Array.isArray(setCodesList) || setCodesList.length === 0) {
        res.status(400).json({ error: 'Invalid setCodes parameter' });
        return;
    }
    
    let cards: CardSet[] = [];
    for (const code of setCodesList) {
        const setCards = store.getCardsBySetCode(code);
        if (!setCards || setCards.length === 0) {
            res.status(404).json({ error: `Set ${code} not found or has no cards` });
            return;
        }
        cards = cards.concat(setCards);
    }
    
    res.json(cards);
}));

/**
 * Get cards by UUIDs
 */
router.post('/uuid', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const cardUuidList = req.body.uuids as string[];
    
    if (!cardUuidList || !Array.isArray(cardUuidList) || cardUuidList.length === 0) {
        res.status(400).json({ error: 'Invalid uuids parameter' });
        return;
    }
    
    const cards = await store.getCardsByUuid(cardUuidList);
    if (!cards || cards.length === 0) {
        res.status(404).json({ error: 'No cards found with provided UUIDs' });
        return;
    }
    
    res.json(cards);
}));

/**
 * Search cards by name
 */
router.get('/search', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const name = req.query.name as string;
    const limit = parseInt(req.query.limit as string || '20', 10);
    
    if (!name) {
        res.status(400).json({ error: 'Name parameter is required' });
        return;
    }
    
    const cards = await store.searchCards(name, limit);
    if (!cards || cards.length === 0) {
        res.status(404).json({ error: 'No cards found matching the search criteria' });
        return;
    }
    
    res.json(cards);
}));

/**
 * Get historical prices and moving averages for a card UUID
 */
router.get('/:uuid/prices/historic', asyncHandler(async (req, res) => {
    const uuid = req.params.uuid;
    const provider = typeof req.query.provider === 'string' ? req.query.provider.trim().toLowerCase() : undefined;
    const priceType = typeof req.query.priceType === 'string' ? req.query.priceType.trim().toLowerCase() : undefined;
    const finish = typeof req.query.finish === 'string' ? req.query.finish.trim().toLowerCase() : undefined;

    if (!uuid) {
        res.status(400).json({ error: 'UUID parameter is required' });
        return;
    }

    if (priceType && priceType !== 'retail' && priceType !== 'buylist') {
        res.status(400).json({ error: 'Invalid priceType. Expected retail or buylist.' });
        return;
    }

    const historical = await getPriceHistoryByUuid(uuid, {
        provider,
        priceType,
        finish
    });
    if (!historical.length) {
        res.status(404).json({ error: `No historical prices found for UUID ${uuid}` });
        return;
    }

    res.json({
        historical,
        averages: calculateMovingAverages(historical)
    });
}));

/**
 * Get batched historical price moving averages (90/30/7 day) for a list of
 * card UUIDs. Intended for page-level summaries (e.g. Market Data list/grid
 * views) where a full history isn't needed - just the averages to display
 * alongside the current retail price range.
 */
router.post('/prices/historic/batch', asyncHandler(async (req, res) => {
    const uuids = req.body.uuids as string[];
    const finishParam = typeof req.body.finish === 'string' ? req.body.finish.trim().toLowerCase() : undefined;

    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        res.status(400).json({ error: 'Invalid uuids parameter' });
        return;
    }

    if (finishParam && finishParam !== 'normal' && finishParam !== 'foil') {
        res.status(400).json({ error: 'Invalid finish. Expected normal or foil.' });
        return;
    }

    const finish = finishParam ?? 'normal';

    const historyByUuid = await getPriceHistoryByUuids(uuids, {
        priceType: 'retail',
        finish
    });

    const results = uuids.map((uuid) => ({
        uuid,
        finish,
        averages: calculateMovingAverages(historyByUuid[uuid] ?? [])
    }));

    res.json({ results });
}));

export default router;

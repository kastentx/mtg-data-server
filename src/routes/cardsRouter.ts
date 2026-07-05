import express from 'express';
import asyncHandler from 'express-async-handler';
import CardDataStore from '../store/cardData';
import { CardSet } from '../types';
import { getPriceHistoryByUuid } from '../database/db';

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

function calculateMovingAverageForWindow(
    historicalPrices: Array<{ date: string; price: number }>,
    windowDays: number
): number | null {
    if (!historicalPrices.length) {
        return null;
    }

    const latestDate = new Date(historicalPrices[0].date);
    if (Number.isNaN(latestDate.getTime())) {
        return null;
    }

    const windowStart = new Date(latestDate);
    windowStart.setDate(windowStart.getDate() - (windowDays - 1));

    const windowPrices = historicalPrices
        .filter((entry) => {
            const entryDate = new Date(entry.date);
            return !Number.isNaN(entryDate.getTime()) && entryDate >= windowStart;
        })
        .map((entry) => entry.price)
        .filter((price) => Number.isFinite(price));

    if (!windowPrices.length) {
        return null;
    }

    const sum = windowPrices.reduce((acc, price) => acc + price, 0);
    return Number((sum / windowPrices.length).toFixed(4));
}

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
        averages: {
            movingAverage90Day: calculateMovingAverageForWindow(historical, 90),
            movingAverage30Day: calculateMovingAverageForWindow(historical, 30),
            movingAverage7Day: calculateMovingAverageForWindow(historical, 7)
        }
    });
}));

export default router;

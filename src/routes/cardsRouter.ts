import express from 'express';
import asyncHandler from 'express-async-handler';
import CardDataStore from '../store/cardData';
import { CardSet } from '../types';

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

export default router;

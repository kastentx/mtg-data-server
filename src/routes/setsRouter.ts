import express from 'express';
import asyncHandler from 'express-async-handler';
import CardDataStore from '../store/cardData';
import { SetList } from '../types';

const router = express.Router();

/**
 * Get all available sets
 */
router.get('/', asyncHandler(async (_req, res) => {
    const store = CardDataStore.getInstance();
    const sets = store.getAvailableSets();
    
    if (!sets || sets.length === 0) {
        res.status(404).json({ error: 'No sets found' });
        return;
    }
    
    res.json(sets.map((set) => ({
        name: set.name,
        code: set.code,
        keyruneCode: set.keyruneCode,
        releaseDate: set.releaseDate,
        type: set.type
    })));
}));

/**
 * Get specific sets by codes
 */
router.post('/', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const setCodeList = req.body.setCodes as string[];
    
    if (!setCodeList || !Array.isArray(setCodeList) || setCodeList.length === 0) {
        res.status(400).json({ error: 'Invalid setCodes parameter' });
        return;
    }
    
    const sets: SetList[] = [];
    for (const code of setCodeList) {
        const set = store.getSetbyCode(code);
        if (!set) {
            res.status(404).json({ error: `Set ${code} not found` });
            return;
        }
        sets.push(set);
    }
    
    res.json(sets);
}));

export default router;

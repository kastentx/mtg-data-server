import express from 'express';
import asyncHandler from 'express-async-handler';
import CardDataStore from '../store/cardData';
import { SetList } from '../types';

const router = express.Router();

router.get('/', asyncHandler(async (_req, res) => {
    const store = CardDataStore.getInstance();
    const sets = store.getAvailableSets();
    if (!sets) {
        res.status(404).json({ error: 'Card data not found' });
        return;
    }
    res.json(sets.map((set) => ({
        name: set.name,
        code: set.code,
        keyruneCode: set.keyruneCode,
    })));
}));

router.post('/', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const setCodeList = req.body.setCodes as string[];
    let sets: SetList[] = [];
    setCodeList.forEach((code) => {
        if (!store.getSetbyCode(code)) {
            res.status(404).json({ error: `Set ${code} not found` });
            return;
        }
        sets.push(store.getSetbyCode(code) as SetList);
    });
    res.json(sets);
}));

export default router;

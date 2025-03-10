import express from 'express';
import asyncHandler from 'express-async-handler';
import CardDataStore from '../store/cardData';
import { Set } from '../types';

const router = express.Router();

router.get('/set-names', asyncHandler(async (_req, res) => {
    const store = CardDataStore.getInstance();
    const dataFile = store.getData();
    const data = dataFile?.data as Record<string, Set>;
    if (!data) {
        res.status(404).json({ error: 'Card data not found' });
        return;
    }

    res.json(Object.values(data).map((set) => ({
        code: set.code,
        name: set.name
    })));
}));

router.get('/sets/:code', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const dataFile = store.getData();
    const data = dataFile?.data as Record<string, Set>;
    if (!data) {
        res.status(404).json({ error: 'Card data not found' });
        return;
    }

    const set = data[req.params.code];
    if (!set) {
        res.status(404).json({ error: 'Set not found' });
        return;
    }

    res.json(set);
}));

router.post('/sets', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const dataFile = store.getData();
    const data = dataFile?.data as Record<string, Set>;
    if (!data) {
        res.status(404).json({ error: 'Card data not found' });
        return;
    }

    // get list of set codes from request body, and return all sets with those codes
    const setCodes: string[] = req.body?.setCodes || [];
    const sets = setCodes.map((code) => data[code]);
    console.log('Set codes:', setCodes);
    console.log('Sets:', sets);

    res.json(sets);
}));

export default router;

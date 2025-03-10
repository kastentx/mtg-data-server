import express from 'express';
import asyncHandler from 'express-async-handler';
import { checkRemoteFileModified } from '../helpers/mtgJsonHelpers';
import CardDataStore from '../store/cardData';
import { Meta, Set, SetList } from '../types';

const router = express.Router();

router.get('/status', asyncHandler(async (_req, res) => {
    const status = 'OK';
    res.json(status);
}));

router.get('/last-modified', asyncHandler(async (_req, res, next) => {
    try {
        const lastModified = await checkRemoteFileModified();
        res.json({ lastModified });
    } catch (error) {
        next(error);
    }
}));

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

export default router;

import express from 'express';
import asyncHandler from 'express-async-handler';
import { checkRemoteFileModified } from '../helpers/mtgJsonHelpers';
import CardDataStore from '../store/cardData';

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

router.get('/meta', asyncHandler(async (_req, res) => {
    const store = CardDataStore.getInstance();
    const { meta } = store.getData();
    if (!meta) {
        res.status(404).json({ error: 'Meta data not found' });
        return;
    }
    res.json({ keys: Object.keys(meta) });
}));
router.get('/data', asyncHandler(async (_req, res) => {
    const store = CardDataStore.getInstance();
    const { data } = store.getData();
    if (!data) {
        res.status(404).json({ error: 'Card data not found' });
        return;
    }
    res.json({ keys: Object.keys(data) });
}));

export default router;

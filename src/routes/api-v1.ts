import express from 'express';
import asyncHandler from 'express-async-handler';
import { checkRemoteFileModified } from '../helpers/mtgJsonHelpers';
import CardDataStore from '../store/cardData';
import { SetList } from '../types';

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

router.get('/sets', asyncHandler(async (_req, res) => {
    const store = CardDataStore.getInstance();
    const { data } = store.getData();
    if (!data) {
        res.status(404).json({ error: 'Card data not found' });
        return;
    }
    // each key in the data object is a setList object
    // lets return a list of setlist objects that match the setlist type 1:1
    // const setLists = Object.keys(data).map((key) => data[key] as SetList);
    const setLists = Object.keys(data).map((key) => {
        const setList = data[key] as SetList;
        return {
            code: setList.code,
            name: setList.name,
            type: setList.type,
            releaseDate: setList.releaseDate,
            block: setList.block,
            onlineOnly: setList.isOnlineOnly,
        };
    });
    
    res.json(setLists); 
}));

router.get('/sets/metadata', asyncHandler(async (_req, res) => {
    const store = CardDataStore.getInstance();
    const { data } = store.getData();
    if (!data) {
        res.status(404).json({ error: 'Card data not found' });
        return;
    }
    
    const allSets = Object.keys(data).map((key) => {
        const setMetadata = data[key] as SetList;
        return {
            code: setMetadata.code,
            name: setMetadata.name,
            type: setMetadata.type,
            releaseDate: setMetadata.releaseDate,
            block: setMetadata.block,
            isOnlineOnly: setMetadata.isOnlineOnly
        };
    });
    
    res.json(allSets); 
}));


export default router;

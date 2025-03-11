import express from 'express';
import asyncHandler from 'express-async-handler';
import CardDataStore from '../store/cardData';
import { CardSet } from '../types';


const router = express.Router();

// router.get('/', asyncHandler(async (_req, res) => {
//     const store = CardDataStore.getInstance();
//     const sets = store.getAvailableSets();
//     if (!sets) {
//         res.status(404).json({ error: 'Card data not found' });
//         return;
//     }
//     res.json(sets.map((set) => ({
//         name: set.name,
//         code: set.code,
//         keyruneCode: set.keyruneCode,
//     })));
// }));

router.post('/', asyncHandler(async (req, res) => {
    const store = CardDataStore.getInstance();
    const setCodesList = req.body.setCodes as string[];
    console.log('setCodesList:', setCodesList);
    let cards: CardSet[] = [];
    setCodesList.forEach((code) => {
        if (!store.getCardsBySetCode(code)) {
            res.status(404).json({ error: `Set ${code} not found` });
            return;
        }
        cards = cards.concat(store.getCardsBySetCode(code) as CardSet[]);
    });
    res.json(cards);
}));

export default router;

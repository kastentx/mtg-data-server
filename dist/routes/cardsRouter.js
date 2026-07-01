"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const cardData_1 = __importDefault(require("../store/cardData"));
const router = express_1.default.Router();
/**
 * Get cards by set codes
 */
router.post('/set-code', (0, express_async_handler_1.default)(async (req, res) => {
    const store = cardData_1.default.getInstance();
    const setCodesList = req.body.setCodes;
    if (!setCodesList || !Array.isArray(setCodesList) || setCodesList.length === 0) {
        res.status(400).json({ error: 'Invalid setCodes parameter' });
        return;
    }
    let cards = [];
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
router.post('/uuid', (0, express_async_handler_1.default)(async (req, res) => {
    const store = cardData_1.default.getInstance();
    const cardUuidList = req.body.uuids;
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
router.get('/search', (0, express_async_handler_1.default)(async (req, res) => {
    const store = cardData_1.default.getInstance();
    const name = req.query.name;
    const limit = parseInt(req.query.limit || '20', 10);
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
exports.default = router;

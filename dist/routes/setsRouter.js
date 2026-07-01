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
 * Get all available sets
 */
router.get('/', (0, express_async_handler_1.default)(async (_req, res) => {
    const store = cardData_1.default.getInstance();
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
router.post('/', (0, express_async_handler_1.default)(async (req, res) => {
    const store = cardData_1.default.getInstance();
    const setCodeList = req.body.setCodes;
    if (!setCodeList || !Array.isArray(setCodeList) || setCodeList.length === 0) {
        res.status(400).json({ error: 'Invalid setCodes parameter' });
        return;
    }
    const sets = [];
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
exports.default = router;

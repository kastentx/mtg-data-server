"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const dataService_1 = require("../services/dataService");
const router = express_1.default.Router();
/**
 * Admin dashboard route
 */
router.get('/', async (req, res) => {
    const lastModifiedRemote = await (0, dataService_1.checkRemoteFileModified)();
    const lastModifiedLocal = await (0, dataService_1.checkLocalFileModified)();
    res.render('admin', {
        title: 'MTG Admin Dashboard',
        layout: 'main',
        lastModifiedRemote,
        lastModifiedLocal
    });
});
/**
 * Get API status
 */
router.get('/status', (0, express_async_handler_1.default)(async (_req, res) => {
    res.json({ status: 'OK' });
}));
/**
 * Get last modified date
 */
router.get('/last-modified', (0, express_async_handler_1.default)(async (_req, res) => {
    const lastModifiedRemote = await (0, dataService_1.checkRemoteFileModified)();
    const lastModifiedLocal = await (0, dataService_1.checkLocalFileModified)();
    res.json({ lastModifiedRemote, lastModifiedLocal });
}));
/**
 * Download latest data
 */
router.post('/download', async (req, res) => {
    try {
        await (0, dataService_1.downloadCardData)();
        res.redirect('/admin');
    }
    catch (error) {
        console.error('Error downloading data:', error);
        res.status(500).send('Error downloading data');
    }
});
/**
 * Load local data into memory
 */
router.post('/load-data', async (req, res) => {
    try {
        await (0, dataService_1.initializeCardStore)();
        res.redirect('/admin');
    }
    catch (error) {
        console.error('Error loading data:', error);
        res.status(500).send('Error loading data');
    }
});
/**
 * Refresh card and pricing data from remote sources and reload store
 */
router.post('/refresh-data', (0, express_async_handler_1.default)(async (_req, res) => {
    const result = await (0, dataService_1.refreshDataAndReload)();
    res.json({
        status: 'OK',
        message: 'Data refresh completed',
        ...result
    });
}));
exports.default = router;

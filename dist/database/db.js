"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCardDatabase = getCardDatabase;
exports.getPricingDatabase = getPricingDatabase;
exports.loadMetadata = loadMetadata;
exports.loadSetList = loadSetList;
exports.loadCards = loadCards;
exports.getCardsByUuid = getCardsByUuid;
exports.searchCardsByName = searchCardsByName;
exports.closeConnections = closeConnections;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const DATA_DIR = 'data';
const CARD_DB_FILE = 'AllPrintings.sqlite';
const PRICING_DB_FILE = 'AllPricesToday.sqlite';
const CARD_DB_PATH = path_1.default.join(DATA_DIR, CARD_DB_FILE);
const PRICING_DB_PATH = path_1.default.join(DATA_DIR, PRICING_DB_FILE);
// Database connection cache
let cardDb = null;
let pricingDb = null;
/**
 * Gets or creates a connection to the card database
 */
async function getCardDatabase() {
    if (!cardDb) {
        if (!(0, fs_1.existsSync)(CARD_DB_PATH)) {
            throw new Error(`Card database not found at ${CARD_DB_PATH}. Please download it first.`);
        }
        console.log(`Opening SQLite database at ${CARD_DB_PATH}`);
        cardDb = await (0, sqlite_1.open)({
            filename: CARD_DB_PATH,
            driver: sqlite3_1.default.Database,
            mode: sqlite3_1.default.OPEN_READONLY
        });
        console.log('Database connection established');
    }
    return cardDb;
}
/**
 * Gets or creates a connection to the pricing database
 */
async function getPricingDatabase() {
    if (!pricingDb) {
        if (!(0, fs_1.existsSync)(PRICING_DB_PATH)) {
            throw new Error(`Pricing database not found at ${PRICING_DB_PATH}. Please download it first.`);
        }
        console.log(`Opening pricing SQLite database at ${PRICING_DB_PATH}`);
        pricingDb = await (0, sqlite_1.open)({
            filename: PRICING_DB_PATH,
            driver: sqlite3_1.default.Database,
            mode: sqlite3_1.default.OPEN_READONLY
        });
        console.log('Pricing database connection established');
    }
    return pricingDb;
}
/**
 * Load metadata from the database
 */
async function loadMetadata() {
    try {
        const db = await getCardDatabase();
        const metaRow = await db.get('SELECT date, version FROM meta LIMIT 1');
        if (metaRow) {
            return metaRow;
        }
        return { date: '', version: '' };
    }
    catch (error) {
        console.error('Error loading metadata:', error);
        return { date: '', version: '' };
    }
}
/**
 * Load the list of all available sets from the database
 */
async function loadSetList() {
    try {
        const db = await getCardDatabase();
        const tableCheck = await db.get(`SELECT name FROM sqlite_master 
            WHERE type='table' AND name='sets'`);
        if (!tableCheck) {
            console.warn("Sets table doesn't exist in the database");
            return [];
        }
        const sets = await db.all('SELECT * FROM sets');
        return sets;
    }
    catch (error) {
        console.error('Error loading set list:', error);
        return [];
    }
}
/**
 * Load card data with optional pricing information
 */
async function loadCards() {
    try {
        const db = await getCardDatabase();
        const tableCheck = await db.get(`SELECT name FROM sqlite_master
            WHERE type='table' AND name='cards'`);
        if (!tableCheck) {
            console.warn("Cards table doesn't exist in the database");
            return [];
        }
        // Get all cards from the cards table
        const cards = await db.all('SELECT * FROM cards');
        // Get card identifiers and create a lookup map
        const cardIdentifiers = await db.all('SELECT * FROM cardIdentifiers');
        const cardIdentifiersMap = cardIdentifiers.reduce((acc, row) => {
            acc[row.uuid] = row;
            return acc;
        }, {});
        // Load pricing data if available
        const pricingDataMap = await loadPricingData();
        // Combine all data and return the complete card list
        return cards.map((card) => {
            return {
                ...card,
                identifiers: cardIdentifiersMap[card.uuid] || null,
                pricing: pricingDataMap[card.uuid] || null
            };
        });
    }
    catch (error) {
        console.error('Error loading card list:', error);
        return [];
    }
}
/**
 * Load pricing data for all cards
 */
async function loadPricingData() {
    let pricingDataMap = {};
    try {
        const pricingDb = await getPricingDatabase();
        // Check if the pricing database has the necessary table
        const pricingTableCheck = await pricingDb.get(`SELECT name FROM sqlite_master
            WHERE type='table' AND name='prices'`);
        if (pricingTableCheck) {
            console.log('Loading pricing information...');
            // Get the latest pricing information for paper
            const prices = await pricingDb.all('SELECT * FROM prices WHERE source="paper" AND currency="USD" AND date = (SELECT MAX(date) FROM prices)');
            // Create a simpler pricing data structure
            pricingDataMap = prices.reduce((acc, row) => {
                var _a, _b;
                if (!acc[row.uuid]) {
                    acc[row.uuid] = {};
                }
                // Get the listing type (retail or buylist) and use as top level key
                const listingType = ((_a = row.priceType) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'buylist' ? 'buylist' : 'retail';
                if (!acc[row.uuid][listingType]) {
                    acc[row.uuid][listingType] = {};
                }
                // Use card finish as second level
                const cardFinish = ((_b = row.finish) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || 'normal';
                if (acc[row.uuid][listingType][cardFinish] === undefined) {
                    acc[row.uuid][listingType][cardFinish] = {};
                }
                // Store price provider and price directly
                if (row.price !== null && row.price !== undefined) {
                    const priceProvider = String(row.provider || 'unknown').toLowerCase();
                    acc[row.uuid][listingType][cardFinish][priceProvider] = row.price;
                }
                return acc;
            }, {});
            console.log(`Loaded pricing data for ${Object.keys(pricingDataMap).length} cards`);
        }
        else {
            console.warn("Pricing table doesn't exist in the pricing database");
        }
    }
    catch (error) {
        console.warn('Failed to load pricing data:', error);
    }
    return pricingDataMap;
}
/**
 * Get cards by their UUIDs with pricing information
 */
async function getCardsByUuid(uuids) {
    if (!uuids.length)
        return [];
    try {
        const db = await getCardDatabase();
        // Get cards by UUIDs
        const placeholders = uuids.map(() => '?').join(',');
        const cards = await db.all(`SELECT * FROM cards WHERE uuid IN (${placeholders})`, uuids);
        // Get identifiers
        const identifiers = await db.all(`SELECT * FROM cardIdentifiers WHERE uuid IN (${placeholders})`, uuids);
        const identifiersMap = identifiers.reduce((acc, row) => {
            acc[row.uuid] = row;
            return acc;
        }, {});
        // Get pricing data
        let pricingDataMap = {};
        try {
            const pricingDb = await getPricingDatabase();
            const prices = await pricingDb.all(`SELECT * FROM prices WHERE source="paper" AND currency="USD" AND date = (SELECT MAX(date) FROM prices) AND uuid IN (${placeholders})`, uuids);
            prices.forEach((row) => {
                var _a, _b;
                if (!pricingDataMap[row.uuid]) {
                    pricingDataMap[row.uuid] = {};
                }
                const listingType = ((_a = row.priceType) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'buylist' ? 'buylist' : 'retail';
                if (!pricingDataMap[row.uuid][listingType]) {
                    pricingDataMap[row.uuid][listingType] = {};
                }
                const cardFinish = ((_b = row.finish) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || 'normal';
                if (pricingDataMap[row.uuid][listingType][cardFinish] === undefined) {
                    pricingDataMap[row.uuid][listingType][cardFinish] = {};
                }
                if (row.price !== null && row.price !== undefined) {
                    const priceProvider = String(row.provider || 'unknown').toLowerCase();
                    pricingDataMap[row.uuid][listingType][cardFinish][priceProvider] = row.price;
                }
            });
        }
        catch (error) {
            console.warn('Failed to get pricing data:', error);
        }
        // Combine data
        return cards.map((card) => ({
            ...card,
            identifiers: identifiersMap[card.uuid] || null,
            pricing: pricingDataMap[card.uuid] || null
        }));
    }
    catch (error) {
        console.error('Failed to get cards by UUID:', error);
        return [];
    }
}
/**
 * Search for cards by name
 */
async function searchCardsByName(name, limit = 20) {
    try {
        const db = await getCardDatabase();
        const cards = await db.all(`SELECT * FROM cards 
             WHERE name LIKE ? 
             LIMIT ?`, [`%${name}%`, limit]);
        // Get UUIDs to fetch identifiers and pricing
        const uuids = cards.map(c => c.uuid);
        if (uuids.length === 0)
            return [];
        return await getCardsByUuid(uuids);
    }
    catch (error) {
        console.error(`Failed to search cards by name "${name}":`, error);
        return [];
    }
}
/**
 * Close database connections when the application is shutting down
 */
async function closeConnections() {
    if (cardDb) {
        await cardDb.close();
        cardDb = null;
        console.log('Card database connection closed.');
    }
    if (pricingDb) {
        await pricingDb.close();
        pricingDb = null;
        console.log('Pricing database connection closed.');
    }
    console.log('All database connections closed.');
}

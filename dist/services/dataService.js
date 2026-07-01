"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRemoteFileModified = checkRemoteFileModified;
exports.checkRemotePricingFileModified = checkRemotePricingFileModified;
exports.checkLocalFileModified = checkLocalFileModified;
exports.checkLocalPricingFileModified = checkLocalPricingFileModified;
exports.downloadSymbolData = downloadSymbolData;
exports.downloadCardData = downloadCardData;
exports.downloadPricingData = downloadPricingData;
exports.refreshDataAndReload = refreshDataAndReload;
exports.loadSymbolData = loadSymbolData;
exports.initializeCardStore = initializeCardStore;
const adm_zip_1 = __importDefault(require("adm-zip"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const cardData_1 = __importDefault(require("../store/cardData"));
const db_1 = require("../database/db");
const DATA_DIR = 'data';
const CARD_DB_FILE = 'AllPrintings.sqlite';
const PRICING_DB_FILE = 'AllPricesToday.sqlite';
const SYMBOLS_FILE = 'symbols.json';
const AUTO_REFRESH_MIN_AGE_HOURS = 24;
const REMOTE_DATA_URL = 'https://mtgjson.com/api/v5/AllPrintings.sqlite.zip';
const REMOTE_PRICING_URL = 'https://mtgjson.com/api/v5/AllPricesToday.sqlite.zip';
const REMOTE_SYMBOLS_URL = 'https://api.scryfall.com/symbology';
const CARD_DB_PATH = path_1.default.join(DATA_DIR, CARD_DB_FILE);
const PRICING_DB_PATH = path_1.default.join(DATA_DIR, PRICING_DB_FILE);
const SYMBOLS_PATH = path_1.default.join(DATA_DIR, SYMBOLS_FILE);
/**
 * Check if remote data file has been modified
 */
async function checkRemoteFileModified() {
    try {
        const response = await (0, node_fetch_1.default)(REMOTE_DATA_URL, { method: 'HEAD' });
        const lastModified = response.headers.get('last-modified');
        if (!lastModified) {
            return null;
        }
        return new Date(lastModified);
    }
    catch (error) {
        console.warn('Failed to check remote card file modification date:', error);
        return null;
    }
}
/**
 * Check if remote pricing file has been modified
 */
async function checkRemotePricingFileModified() {
    try {
        const response = await (0, node_fetch_1.default)(REMOTE_PRICING_URL, { method: 'HEAD' });
        const lastModified = response.headers.get('last-modified');
        if (!lastModified) {
            return null;
        }
        return new Date(lastModified);
    }
    catch (error) {
        console.warn('Failed to check remote pricing file modification date:', error);
        return null;
    }
}
/**
 * Check if local data file has been modified
 */
async function checkLocalFileModified() {
    try {
        const stats = await promises_1.default.stat(CARD_DB_PATH);
        return new Date(stats.mtime);
    }
    catch {
        return null;
    }
}
/**
 * Check if local pricing file has been modified
 */
async function checkLocalPricingFileModified() {
    try {
        const stats = await promises_1.default.stat(PRICING_DB_PATH);
        return new Date(stats.mtime);
    }
    catch {
        return null;
    }
}
/**
 * Download symbol data from Scryfall
 */
async function downloadSymbolData() {
    try {
        await promises_1.default.mkdir(DATA_DIR, { recursive: true });
        const response = await (0, node_fetch_1.default)(REMOTE_SYMBOLS_URL);
        const data = await response.json();
        const symbols = data.data;
        await promises_1.default.writeFile(SYMBOLS_PATH, JSON.stringify(symbols, null, 2));
    }
    catch (error) {
        console.error('Failed to download symbol data:', error);
        throw error;
    }
}
/**
 * Download and extract card database
 */
async function downloadCardData() {
    try {
        console.log('Downloading card data in SQLite format...');
        await promises_1.default.mkdir(DATA_DIR, { recursive: true });
        const response = await (0, node_fetch_1.default)(REMOTE_DATA_URL);
        const data = await response.arrayBuffer();
        // Create temporary zip file
        const tempZipPath = path_1.default.join(DATA_DIR, `${CARD_DB_FILE}.zip`);
        await promises_1.default.writeFile(tempZipPath, Buffer.from(data));
        // Extract SQLite file from zip
        const zip = new adm_zip_1.default(tempZipPath);
        const zipEntries = zip.getEntries();
        if (zipEntries.length > 0) {
            // Find SQLite file in the archive
            const sqliteEntry = zipEntries.find(entry => entry.name.endsWith('.sqlite') ||
                entry.name === 'AllPrintings.sqlite');
            if (sqliteEntry) {
                console.log(`Extracting ${sqliteEntry.name} to ${CARD_DB_PATH}`);
                zip.extractEntryTo(sqliteEntry.entryName, DATA_DIR, false, true, false, CARD_DB_FILE);
            }
            else {
                throw new Error('No SQLite file found in the card data zip file');
            }
        }
        else {
            throw new Error('No entries found in card data zip file');
        }
        // Clean up temp zip file
        await promises_1.default.unlink(tempZipPath);
        console.log('Card data downloaded and extracted successfully.');
    }
    catch (error) {
        console.error('Failed to download card data:', error);
        throw error;
    }
}
/**
 * Download and extract pricing database
 */
async function downloadPricingData() {
    try {
        console.log('Downloading pricing data in SQLite format...');
        await promises_1.default.mkdir(DATA_DIR, { recursive: true });
        const response = await (0, node_fetch_1.default)(REMOTE_PRICING_URL);
        const data = await response.arrayBuffer();
        // Create temporary zip file
        const tempZipPath = path_1.default.join(DATA_DIR, `${PRICING_DB_FILE}.zip`);
        await promises_1.default.writeFile(tempZipPath, Buffer.from(data));
        // Extract SQLite file from zip
        const zip = new adm_zip_1.default(tempZipPath);
        const zipEntries = zip.getEntries();
        if (zipEntries.length > 0) {
            // Find SQLite file in the archive
            const sqliteEntry = zipEntries.find(entry => entry.name.endsWith('.sqlite') ||
                entry.name === PRICING_DB_FILE);
            if (sqliteEntry) {
                console.log(`Extracting ${sqliteEntry.name} to ${PRICING_DB_PATH}`);
                zip.extractEntryTo(sqliteEntry.entryName, DATA_DIR, false, true, false, PRICING_DB_FILE);
            }
            else {
                throw new Error('No SQLite file found in the pricing data zip file');
            }
        }
        else {
            throw new Error('No entries found in pricing data zip file');
        }
        // Clean up temp zip file
        await promises_1.default.unlink(tempZipPath);
        console.log('Pricing data downloaded and extracted successfully.');
    }
    catch (error) {
        console.error('Failed to download pricing data:', error);
        throw error;
    }
}
function shouldDownload(remoteModified, localModified) {
    if (!localModified) {
        return true;
    }
    if (!remoteModified) {
        return false;
    }
    return remoteModified.getTime() > localModified.getTime();
}
function isOlderThanHours(modifiedDate, hours) {
    if (!modifiedDate) {
        return true;
    }
    const ageMs = Date.now() - modifiedDate.getTime();
    return ageMs >= hours * 60 * 60 * 1000;
}
/**
 * Refresh card and pricing databases if remote sources are newer.
 * Always reloads in-memory stores after any updates.
 */
async function refreshDataAndReload() {
    const localCardModified = await checkLocalFileModified();
    const localPricingModified = await checkLocalPricingFileModified();
    const cardNeedsAgeRefresh = isOlderThanHours(localCardModified, AUTO_REFRESH_MIN_AGE_HOURS);
    const pricingNeedsAgeRefresh = isOlderThanHours(localPricingModified, AUTO_REFRESH_MIN_AGE_HOURS);
    let remoteCardModified = null;
    let remotePricingModified = null;
    if (cardNeedsAgeRefresh) {
        remoteCardModified = await checkRemoteFileModified();
    }
    if (pricingNeedsAgeRefresh) {
        remotePricingModified = await checkRemotePricingFileModified();
    }
    const shouldDownloadCardData = cardNeedsAgeRefresh && shouldDownload(remoteCardModified, localCardModified);
    const shouldDownloadPricing = pricingNeedsAgeRefresh && shouldDownload(remotePricingModified, localPricingModified);
    if (shouldDownloadCardData || shouldDownloadPricing) {
        // Ensure replacement files are picked up by fresh DB handles.
        await (0, db_1.closeConnections)();
    }
    if (shouldDownloadCardData) {
        await downloadCardData();
    }
    if (shouldDownloadPricing) {
        await downloadPricingData();
    }
    // Reload in-memory store from current on-disk files.
    await loadSymbolData();
    await initializeCardStore();
    return {
        cardDataUpdated: shouldDownloadCardData,
        pricingDataUpdated: shouldDownloadPricing
    };
}
/**
 * Load symbol data from JSON file
 */
async function loadSymbolData() {
    try {
        if (!(0, fs_1.existsSync)(SYMBOLS_PATH)) {
            console.warn(`Symbols file not found at ${SYMBOLS_PATH}. Downloading...`);
            await downloadSymbolData();
        }
        const symbolData = JSON.parse(await promises_1.default.readFile(SYMBOLS_PATH, 'utf8'));
        const cardStore = cardData_1.default.getInstance();
        cardStore.setSymbols(symbolData);
        return true;
    }
    catch (error) {
        console.error('Failed to load symbol data:', error);
        throw error;
    }
}
/**
 * Initialize the card data store
 */
async function initializeCardStore() {
    try {
        console.log('Initializing card data store...');
        const cardStore = cardData_1.default.getInstance();
        // Load metadata
        const meta = await (0, db_1.loadMetadata)();
        cardStore.setMetadata(meta);
        // Load sets
        const sets = await (0, db_1.loadSetList)();
        cardStore.setAvailableSets(sets);
        console.log(`Loaded ${sets.length} sets`);
        // Load cards
        const cards = await (0, db_1.loadCards)();
        cardStore.setAvailableCards(cards);
        console.log(`Loaded ${cards.length} cards`);
        return true;
    }
    catch (error) {
        console.error('Failed to initialize card store:', error);
        return false;
    }
}

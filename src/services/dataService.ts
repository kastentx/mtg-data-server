import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import CardDataStore from '../store/cardData';
import { closeConnections, loadMetadata, loadSetList, loadCards } from '../database/db';

const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/pick.js');
const { streamObject } = require('stream-json/streamers/stream-object.js');

const DATA_DIR = 'data';
const CARD_DB_FILE = 'AllPrintings.sqlite';
const PRICING_DB_FILE = 'AllPricesToday.sqlite';
const HISTORICAL_PRICING_DB_FILE = 'AllPrices.sqlite';
const HISTORICAL_PRICING_JSON_FILE = 'AllPrices.json';
const SYMBOLS_FILE = 'symbols.json';
const AUTO_REFRESH_MIN_AGE_HOURS = 24;
const REMOTE_DATA_URL = 'https://mtgjson.com/api/v5/AllPrintings.sqlite';
const REMOTE_PRICING_URL = 'https://mtgjson.com/api/v5/AllPricesToday.sqlite';
const REMOTE_HISTORICAL_PRICING_URL = 'https://mtgjson.com/api/v5/AllPrices.json';
const REMOTE_SYMBOLS_URL = 'https://api.scryfall.com/symbology';
const CARD_DB_PATH = path.join(DATA_DIR, CARD_DB_FILE);
const PRICING_DB_PATH = path.join(DATA_DIR, PRICING_DB_FILE);
const HISTORICAL_PRICING_DB_PATH = path.join(DATA_DIR, HISTORICAL_PRICING_DB_FILE);
const HISTORICAL_PRICING_JSON_PATH = path.join(DATA_DIR, HISTORICAL_PRICING_JSON_FILE);
const SYMBOLS_PATH = path.join(DATA_DIR, SYMBOLS_FILE);

interface DownloadedPayload {
    data: Buffer;
    isZip: boolean;
    url: string;
}

async function assertSuccessfulFetch(response: { ok: boolean; status: number; headers: { get(name: string): string | null; }; text(): Promise<string>; }, sourceLabel: string): Promise<void> {
    if (response.ok) {
        return;
    }

    const bodyPreview = (await response.text()).slice(0, 300);
    throw new Error(`${sourceLabel} download failed with status ${response.status}. Response preview: ${bodyPreview}`);
}

function buildZipUrl(url: string): string {
    return `${url}.zip`;
}

async function downloadWithZipFallback(baseUrl: string, sourceLabel: string): Promise<DownloadedPayload> {
    const zipUrl = buildZipUrl(baseUrl);
    const zipResponse = await fetch(zipUrl);

    if (zipResponse.ok) {
        return {
            data: Buffer.from(await zipResponse.arrayBuffer()),
            isZip: true,
            url: zipUrl
        };
    }

    console.warn(
        `${sourceLabel} zip download unavailable (status ${zipResponse.status}). Falling back to direct download.`
    );

    const directResponse = await fetch(baseUrl);
    await assertSuccessfulFetch(directResponse, sourceLabel);

    return {
        data: Buffer.from(await directResponse.arrayBuffer()),
        isZip: false,
        url: baseUrl
    };
}

async function getRemoteLastModifiedWithZipFallback(baseUrl: string, sourceLabel: string): Promise<Date | null> {
    const zipUrl = buildZipUrl(baseUrl);

    try {
        const zipHeadResponse = await fetch(zipUrl, { method: 'HEAD' });
        if (zipHeadResponse.ok) {
            const lastModified = zipHeadResponse.headers.get('last-modified');
            return lastModified ? new Date(lastModified) : null;
        }

        console.warn(
            `${sourceLabel} zip HEAD check unavailable (status ${zipHeadResponse.status}). Falling back to direct HEAD check.`
        );
    } catch (error) {
        console.warn(`${sourceLabel} zip HEAD check failed. Falling back to direct HEAD check.`, error);
    }

    try {
        const directHeadResponse = await fetch(baseUrl, { method: 'HEAD' });
        if (!directHeadResponse.ok) {
            return null;
        }

        const lastModified = directHeadResponse.headers.get('last-modified');
        return lastModified ? new Date(lastModified) : null;
    } catch (error) {
        console.warn(`Failed to check remote ${sourceLabel.toLowerCase()} file modification date:`, error);
        return null;
    }
}

async function extractZipEntryToFile(
    zipData: Buffer,
    outputPath: string,
    notFoundMessage: string,
    entryMatcher: (entryName: string) => boolean
): Promise<void> {
    const zip = new AdmZip(zipData);
    const zipEntries = zip.getEntries();

    if (zipEntries.length === 0) {
        throw new Error('No entries found in zip file');
    }

    const matchedEntry = zipEntries.find((entry) => entryMatcher(entry.name));
    if (!matchedEntry) {
        throw new Error(notFoundMessage);
    }

    const extractedData = matchedEntry.getData();
    await fs.writeFile(outputPath, extractedData);
}

async function buildHistoricalPricingSqliteFromJson(jsonPath: string, outputPath: string): Promise<void> {
    const tempDbPath = `${outputPath}.tmp`;
    if (existsSync(tempDbPath)) {
        await fs.unlink(tempDbPath);
    }

    const db = await open({
        filename: tempDbPath,
        driver: sqlite3.Database
    });

    try {
        await db.exec('PRAGMA journal_mode = WAL');
        await db.exec('PRAGMA synchronous = NORMAL');
        await db.exec('PRAGMA temp_store = MEMORY');

        await db.exec(`
            CREATE TABLE IF NOT EXISTS prices (
                uuid TEXT,
                date TEXT,
                source TEXT,
                provider TEXT,
                priceType TEXT,
                finish TEXT,
                price REAL,
                currency TEXT
            )
        `);

        const insertStmt = await db.prepare(
            `INSERT INTO prices (uuid, date, source, provider, priceType, finish, price, currency)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        let rowCount = 0;
        const commitInterval = 50000;

        const dataStream = chain([
            createReadStream(jsonPath),
            parser(),
            pick({ filter: 'data' }),
            streamObject()
        ]);

        await db.exec('BEGIN TRANSACTION');
        for await (const row of dataStream) {
            const uuid = String(row.key || '');
            const cardPriceData = row.value as Record<string, any>;

            for (const [source, sourceData] of Object.entries(cardPriceData || {})) {
                if (!sourceData || typeof sourceData !== 'object') {
                    continue;
                }

                for (const [provider, providerData] of Object.entries(sourceData as Record<string, any>)) {
                    if (!providerData || typeof providerData !== 'object') {
                        continue;
                    }

                    const currency = typeof providerData.currency === 'string' ? providerData.currency : null;
                    for (const priceType of ['buylist', 'retail']) {
                        const finishPrices = providerData[priceType];
                        if (!finishPrices || typeof finishPrices !== 'object') {
                            continue;
                        }

                        for (const [finish, datedPrices] of Object.entries(finishPrices as Record<string, any>)) {
                            if (!datedPrices || typeof datedPrices !== 'object') {
                                continue;
                            }

                            for (const [date, priceValue] of Object.entries(datedPrices as Record<string, any>)) {
                                const numericPrice = Number(priceValue);
                                if (!Number.isFinite(numericPrice)) {
                                    continue;
                                }

                                await insertStmt.run([
                                    uuid,
                                    date,
                                    source,
                                    provider,
                                    priceType,
                                    finish,
                                    numericPrice,
                                    currency
                                ]);
                                rowCount += 1;

                                if (rowCount % commitInterval === 0) {
                                    await db.exec('COMMIT');
                                    await db.exec('BEGIN TRANSACTION');
                                    console.log(`Processed ${rowCount.toLocaleString()} historical price rows...`);
                                }
                            }
                        }
                    }
                }
            }
        }
        await db.exec('COMMIT');

        await insertStmt.finalize();

        await db.exec('CREATE INDEX IF NOT EXISTS idx_prices_uuid ON prices(uuid)');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_prices_uuid_date ON prices(uuid, date)');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_prices_source_currency ON prices(source, currency)');

        console.log(`Historical pricing SQLite build completed with ${rowCount.toLocaleString()} rows.`);
    } catch (error) {
        try {
            await db.exec('ROLLBACK');
        } catch {
            // Ignore rollback failures.
        }
        throw error;
    } finally {
        await db.close();
    }

    if (existsSync(outputPath)) {
        await fs.unlink(outputPath);
    }
    await fs.rename(tempDbPath, outputPath);
}

/**
 * Check if remote data file has been modified
 */
export async function checkRemoteFileModified(): Promise<Date | null> {
    return getRemoteLastModifiedWithZipFallback(REMOTE_DATA_URL, 'Card data');
}

/**
 * Check if remote pricing file has been modified
 */
export async function checkRemotePricingFileModified(): Promise<Date | null> {
    return getRemoteLastModifiedWithZipFallback(REMOTE_PRICING_URL, 'Pricing data');
}

/**
 * Check if remote historical pricing file has been modified
 */
export async function checkRemoteHistoricalPricingFileModified(): Promise<Date | null> {
    return getRemoteLastModifiedWithZipFallback(REMOTE_HISTORICAL_PRICING_URL, 'Historical pricing data');
}

/**
 * Check if local data file has been modified
 */
export async function checkLocalFileModified(): Promise<Date | null> {
    try {
        const stats = await fs.stat(CARD_DB_PATH);
        return new Date(stats.mtime);
    } catch {
        return null;
    }
}

/**
 * Check if local pricing file has been modified
 */
export async function checkLocalPricingFileModified(): Promise<Date | null> {
    try {
        const stats = await fs.stat(PRICING_DB_PATH);
        return new Date(stats.mtime);
    } catch {
        return null;
    }
}

/**
 * Check if local historical pricing file has been modified
 */
export async function checkLocalHistoricalPricingFileModified(): Promise<Date | null> {
    try {
        const stats = await fs.stat(HISTORICAL_PRICING_DB_PATH);
        return new Date(stats.mtime);
    } catch {
        return null;
    }
}

/**
 * Download symbol data from Scryfall
 */
export async function downloadSymbolData(): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const response = await fetch(REMOTE_SYMBOLS_URL);
        const data = await response.json() as Record<string, any>;
        const symbols = data.data;
        await fs.writeFile(SYMBOLS_PATH, JSON.stringify(symbols, null, 2));
    } catch (error) {
        console.error('Failed to download symbol data:', error);
        throw error;
    }
}

/**
 * Download and extract card database
 */
export async function downloadCardData(): Promise<void> {
    try {
        console.log('Downloading card data in SQLite format...');
        await fs.mkdir(DATA_DIR, { recursive: true });

        const downloadedPayload = await downloadWithZipFallback(REMOTE_DATA_URL, 'Card data');
        if (downloadedPayload.isZip) {
            await extractZipEntryToFile(
                downloadedPayload.data,
                CARD_DB_PATH,
                'No SQLite file found in the card data zip file',
                (entryName) => entryName.endsWith('.sqlite') || entryName.endsWith(CARD_DB_FILE)
            );
            console.log(`Extracted card data from ${downloadedPayload.url} to ${CARD_DB_PATH}`);
        } else {
            await fs.writeFile(CARD_DB_PATH, downloadedPayload.data);
            console.log(`Saved card data from ${downloadedPayload.url} to ${CARD_DB_PATH}`);
        }

        console.log('Card data downloaded and extracted successfully.');
    } catch (error) {
        console.error('Failed to download card data:', error);
        throw error;
    }
}

/**
 * Download and extract pricing database
 */
export async function downloadPricingData(): Promise<void> {
    try {
        console.log('Downloading pricing data in SQLite format...');
        await fs.mkdir(DATA_DIR, { recursive: true });

        const downloadedPayload = await downloadWithZipFallback(REMOTE_PRICING_URL, 'Pricing data');
        if (downloadedPayload.isZip) {
            await extractZipEntryToFile(
                downloadedPayload.data,
                PRICING_DB_PATH,
                'No SQLite file found in the pricing data zip file',
                (entryName) => entryName.endsWith('.sqlite') || entryName.endsWith(PRICING_DB_FILE)
            );
            console.log(`Extracted pricing data from ${downloadedPayload.url} to ${PRICING_DB_PATH}`);
        } else {
            await fs.writeFile(PRICING_DB_PATH, downloadedPayload.data);
            console.log(`Saved pricing data from ${downloadedPayload.url} to ${PRICING_DB_PATH}`);
        }

        console.log('Pricing data downloaded and extracted successfully.');
    } catch (error) {
        console.error('Failed to download pricing data:', error);
        throw error;
    }
}

/**
 * Download and extract historical pricing database
 */
export async function downloadHistoricalPricing(): Promise<void> {
    try {
        console.log('Downloading historical pricing data in JSON format and converting to SQLite...');
        await fs.mkdir(DATA_DIR, { recursive: true });

        const downloadedPayload = await downloadWithZipFallback(REMOTE_HISTORICAL_PRICING_URL, 'Historical pricing');
        if (downloadedPayload.isZip) {
            await extractZipEntryToFile(
                downloadedPayload.data,
                HISTORICAL_PRICING_JSON_PATH,
                'No JSON file found in the historical pricing data zip file',
                (entryName) => entryName.endsWith('.json') || entryName.endsWith(HISTORICAL_PRICING_JSON_FILE)
            );
            console.log(
                `Extracted historical pricing JSON from ${downloadedPayload.url} to ${HISTORICAL_PRICING_JSON_PATH}`
            );
        } else {
            await fs.writeFile(HISTORICAL_PRICING_JSON_PATH, downloadedPayload.data);
            console.log(`Saved historical pricing JSON from ${downloadedPayload.url} to ${HISTORICAL_PRICING_JSON_PATH}`);
        }

        await buildHistoricalPricingSqliteFromJson(HISTORICAL_PRICING_JSON_PATH, HISTORICAL_PRICING_DB_PATH);

        // Clean up temporary files
        if (existsSync(HISTORICAL_PRICING_JSON_PATH)) {
            await fs.unlink(HISTORICAL_PRICING_JSON_PATH);
        }
        const legacyBadExtractPath = path.join(DATA_DIR, 'AllPrices');
        if (existsSync(legacyBadExtractPath)) {
            await fs.unlink(legacyBadExtractPath);
        }
        const legacyHistoricalZipPath = path.join(DATA_DIR, `${HISTORICAL_PRICING_DB_FILE}.zip`);
        if (existsSync(legacyHistoricalZipPath)) {
            await fs.unlink(legacyHistoricalZipPath);
        }

        console.log('Historical pricing data downloaded and converted to SQLite successfully.');
    } catch (error) {
        console.error('Failed to download historical pricing data:', error);
        throw error;
    }
}

function shouldDownload(remoteModified: Date | null, localModified: Date | null): boolean {
    if (!localModified) {
        return true;
    }

    if (!remoteModified) {
        return false;
    }

    return remoteModified.getTime() > localModified.getTime();
}

function isOlderThanHours(modifiedDate: Date | null, hours: number): boolean {
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
export async function refreshDataAndReload(): Promise<{
    cardDataUpdated: boolean;
    pricingDataUpdated: boolean;
    historicalPricingDataUpdated: boolean;
}> {
    const localCardModified = await checkLocalFileModified();
    const localPricingModified = await checkLocalPricingFileModified();
    const localHistoricalPricingModified = await checkLocalHistoricalPricingFileModified();

    const cardNeedsAgeRefresh = isOlderThanHours(localCardModified, AUTO_REFRESH_MIN_AGE_HOURS);
    const pricingNeedsAgeRefresh = isOlderThanHours(localPricingModified, AUTO_REFRESH_MIN_AGE_HOURS);
    const historicalPricingNeedsAgeRefresh = isOlderThanHours(localHistoricalPricingModified, AUTO_REFRESH_MIN_AGE_HOURS);

    let remoteCardModified: Date | null = null;
    let remotePricingModified: Date | null = null;
    let remoteHistoricalPricingModified: Date | null = null;

    if (cardNeedsAgeRefresh) {
        remoteCardModified = await checkRemoteFileModified();
    }

    if (pricingNeedsAgeRefresh) {
        remotePricingModified = await checkRemotePricingFileModified();
    }

    if (historicalPricingNeedsAgeRefresh) {
        remoteHistoricalPricingModified = await checkRemoteHistoricalPricingFileModified();
    }

    const shouldDownloadCardData = cardNeedsAgeRefresh && shouldDownload(remoteCardModified, localCardModified);
    const shouldDownloadPricing = pricingNeedsAgeRefresh && shouldDownload(remotePricingModified, localPricingModified);
    const shouldDownloadHistoricalPricing =
        historicalPricingNeedsAgeRefresh &&
        shouldDownload(remoteHistoricalPricingModified, localHistoricalPricingModified);

    if (shouldDownloadCardData || shouldDownloadPricing || shouldDownloadHistoricalPricing) {
        // Ensure replacement files are picked up by fresh DB handles.
        await closeConnections();
    }

    if (shouldDownloadCardData) {
        await downloadCardData();
    }

    if (shouldDownloadPricing) {
        await downloadPricingData();
    }

    if (shouldDownloadHistoricalPricing) {
        await downloadHistoricalPricing();
    }

    // Reload in-memory store from current on-disk files.
    await loadSymbolData();
    await initializeCardStore();

    return {
        cardDataUpdated: shouldDownloadCardData,
        pricingDataUpdated: shouldDownloadPricing,
        historicalPricingDataUpdated: shouldDownloadHistoricalPricing
    };
}

/**
 * Load symbol data from JSON file
 */
export async function loadSymbolData(): Promise<boolean> {
    try {
        if (!existsSync(SYMBOLS_PATH)) {
            console.warn(`Symbols file not found at ${SYMBOLS_PATH}. Downloading...`);
            await downloadSymbolData();
        }
        
        const symbolData = JSON.parse(await fs.readFile(SYMBOLS_PATH, 'utf8'));
        const cardStore = CardDataStore.getInstance();
        cardStore.setSymbols(symbolData);
        return true;
    } catch (error) {
        console.error('Failed to load symbol data:', error);
        throw error;
    }
}

/**
 * Initialize the card data store
 */
export async function initializeCardStore(): Promise<boolean> {
    try {
        console.log('Initializing card data store...');
        const cardStore = CardDataStore.getInstance();
        
        // Load metadata
        const meta = await loadMetadata();
        cardStore.setMetadata(meta);
        
        // Load sets
        const sets = await loadSetList();
        cardStore.setAvailableSets(sets);
        console.log(`Loaded ${sets.length} sets`);
        
        // Load cards
        const cards = await loadCards();
        cardStore.setAvailableCards(cards);
        console.log(`Loaded ${cards.length} cards`);
        
        return true;
    } catch (error) {
        console.error('Failed to initialize card store:', error);
        return false;
    }
}

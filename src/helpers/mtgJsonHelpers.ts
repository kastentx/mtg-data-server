import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import CardDataStore from '../store/cardData';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { getPricingDatabase } from './largeDataHelpers';
import { CardSet } from '../types';

// Update URLs to point to SQLite versions
const REMOTE_DATA_URL = 'https://mtgjson.com/api/v5/AllPrintings.sqlite.zip';
const REMOTE_SYMBOLS_URL = 'https://api.scryfall.com/symbology';
// const REMOTE_PRICING_URL = 'https://mtgjson.com/api/v5/AllPrices.sqlite.zip';  // Commented out pricing URL

const DATA_DIR = 'data';
const DATA_FILE = 'AllPrintings.sqlite';
const SYMBOLS_FILE = 'symbols.json';
// const PRICING_FILE = 'AllPrices.sqlite';  // Commented out pricing file

const DATA_PATH = path.join(DATA_DIR, DATA_FILE);
const SYMBOLS_PATH = path.join(DATA_DIR, SYMBOLS_FILE);
// const PRICING_PATH = path.join(DATA_DIR, PRICING_FILE);  // Commented out pricing path

// Database connection cache
let cardDb: Database | null = null;
// let priceDb: Database | null = null;  // Commented out pricing DB connection

interface timestamp {
    lastModified: string;
}

export async function checkRemoteFileModified() {
    const response = await fetch(REMOTE_DATA_URL, { method: 'HEAD' });
    const lastModified = response.headers.get('last-modified');
    if (!lastModified) {
        return null;
    }
    return new Date(lastModified);
}

export async function checkLocalFileModified() {
    try {
        const stats = await fs.stat(DATA_PATH);
        return new Date(stats.mtime);
    } catch {
        return null;
    }
}

/**
 * Downloads and extracts SQLite pricing database
 */
/*
export async function downloadPricingData() {
    try {
        console.log('Downloading pricing data in SQLite format...');
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        // Close any existing database connection
        if (priceDb) {
            await priceDb.close();
            priceDb = null;
        }
        
        const response = await fetch(REMOTE_PRICING_URL);
        const data = await response.arrayBuffer();
        
        // Create temporary zip file
        const tempZipPath = path.join(DATA_DIR, `${PRICING_FILE}.zip`);
        await fs.writeFile(tempZipPath, Buffer.from(data));
        
        // Extract SQLite file from zip
        const zip = new AdmZip(tempZipPath);
        const zipEntries = zip.getEntries();
        
        if (zipEntries.length > 0) {
            // Find SQLite file in the archive
            const sqliteEntry = zipEntries.find(entry => 
                entry.name.endsWith('.sqlite') || 
                entry.name === 'AllPrices.sqlite'
            );
            
            if (sqliteEntry) {
                console.log(`Extracting ${sqliteEntry.name} to ${PRICING_PATH}`);
                zip.extractEntryTo(sqliteEntry.entryName, DATA_DIR, false, true, false, PRICING_FILE);
            } else {
                throw new Error('No SQLite file found in the pricing data zip file');
            }
        } else {
            throw new Error('No entries found in pricing data zip file');
        }
        
        // Clean up temp zip file
        await fs.unlink(tempZipPath);
        console.log('Pricing data downloaded and extracted successfully.');
    } catch (error) {
        console.error('Failed to download pricing data:', error);
        throw error;
    }
}
*/

export async function downloadSymbolData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const response = await fetch(REMOTE_SYMBOLS_URL);
        const data = await response.json() as Record<string, any>;
        const symbols = data.data;
        // write only the symbols array to json file
        await fs.writeFile(SYMBOLS_PATH, JSON.stringify(symbols, null, 2));
    } catch (error) {
        console.error('Failed to download symbol data:', error);
        throw error;
    }
}

/**
 * Downloads and extracts SQLite card database
 */
export async function downloadCardData() {
    try {
        console.log('Downloading card data in SQLite format...');
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        // Close any existing database connection
        if (cardDb) {
            await cardDb.close();
            cardDb = null;
        }
        
        const response = await fetch(REMOTE_DATA_URL);
        const data = await response.arrayBuffer();
        
        // Create temporary zip file
        const tempZipPath = path.join(DATA_DIR, `${DATA_FILE}.zip`);
        await fs.writeFile(tempZipPath, Buffer.from(data));
        
        // Extract SQLite file from zip
        const zip = new AdmZip(tempZipPath);
        const zipEntries = zip.getEntries();
        
        if (zipEntries.length > 0) {
            // Find SQLite file in the archive
            const sqliteEntry = zipEntries.find(entry => 
                entry.name.endsWith('.sqlite') || 
                entry.name === 'AllPrintings.sqlite'
            );
            
            if (sqliteEntry) {
                console.log(`Extracting ${sqliteEntry.name} to ${DATA_PATH}`);
                zip.extractEntryTo(sqliteEntry.entryName, DATA_DIR, false, true, false, DATA_FILE);
            } else {
                throw new Error('No SQLite file found in the card data zip file');
            }
        } else {
            throw new Error('No entries found in card data zip file');
        }
        
        // Clean up temp zip file
        await fs.unlink(tempZipPath);
        console.log('Card data downloaded and extracted successfully.');
    } catch (error) {
        console.error('Failed to download card data:', error);
        throw error;
    }
}

/**
 * Gets or creates a connection to the pricing database
 */
/*
async function getPricingDatabase(): Promise<Database> {
    if (!priceDb) {
        if (!existsSync(PRICING_PATH)) {
            throw new Error(`Pricing database not found at ${PRICING_PATH}. Please download it first.`);
        }
        
        priceDb = await open({
            filename: PRICING_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });
    }
    return priceDb;
}
*/

/**
 * Gets or creates a connection to the card database
 */
async function getCardDatabase(): Promise<Database> {
    if (!cardDb) {
        if (!existsSync(DATA_PATH)) {
            throw new Error(`Card database not found at ${DATA_PATH}. Please download it first.`);
        }
        
        cardDb = await open({
            filename: DATA_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });
    }
    return cardDb;
}

/**
 * Loads pricing data from SQLite database
 */
/*
export async function loadPricingData() {
    try {
        console.log('Loading pricing data from SQLite database...');
        const cardStore = CardDataStore.getInstance();
        const db = await getPricingDatabase();
        
        // Get metadata
        const metaRow = await db.get('SELECT value FROM meta LIMIT 1');
        let meta = {};
        if (metaRow) {
            try {
                meta = JSON.parse(metaRow.value);
            } catch (e) {
                console.warn('Failed to parse pricing metadata:', e);
            }
        }
        
        // Initialize the pricing data structure
        const pricingData: AllPricesFile = { meta: meta, data: {} };
        cardStore.setPricingData(pricingData);
        
        console.log('Pricing database loaded and ready for querying.');
        return true;
    } catch (error) {
        console.error('Failed to load pricing data:', error);
        throw error;
    }
}
*/

/**
 * Gets pricing data for a specific card UUID
 */
/*
export async function getPriceData(uuid: string) {
    try {
        const db = await getPricingDatabase();
        const result = await db.get(
            'SELECT data FROM prices WHERE uuid = ?',
            [uuid]
        );
        
        if (!result) return null;
        return JSON.parse(result.data);
    } catch (error) {
        console.error(`Failed to get price data for ${uuid}:`, error);
        return null;
    }
}
*/

/**
 * Loads card data from SQLite database
 */
// export async function loadCardData() {
//     try {
//         console.log('Loading card data from SQLite database...');
//         const cardStore = CardDataStore.getInstance();
//         const db = await getCardDatabase();
        
//         // Get metadata
//         const metaRow = await db.get('SELECT value FROM meta LIMIT 1');
//         let meta = {} as Meta;
//         if (metaRow) {
//             try {
//                 meta = JSON.parse(metaRow.value);
//             } catch (e) {
//                 console.warn('Failed to parse card metadata:', e);
//             }
//         }
        
//         // Get list of available sets for the store
//         const sets = await db.all('SELECT code FROM sets');
//         const setList = sets.map(row => row.code);
        
//         // Initialize card data structure with metadata and empty data object
//         const cardData: AllPrintingsFile = { 
//             meta: meta, 
//             data: {}
//         };
        
//         cardStore.setData(cardData);
//         cardStore.setAvailableSets(setList);
        
//         console.log(`Card database loaded with ${setList.length} available sets.`);
//         return true;
//     } catch (error) {
//         console.error('Failed to load card data:', error);
//         throw error;
//     }
// }

/**
 * Get data for a specific set by its code
 */
// export async function getSetData(setCode: string) {
//     try {
//         const db = await getCardDatabase();
//         const setData = await db.get(
//             'SELECT data FROM sets WHERE code = ?',
//             [setCode]
//         );
        
//         if (!setData) return null;
//         return JSON.parse(setData.data);
//     } catch (error) {
//         console.error(`Failed to get set data for ${setCode}:`, error);
//         return null;
//     }
// }

/**
 * Get card by UUID
 */
export async function getCardByUuid(uuid: string) {
    try {
        const db = await getCardDatabase();
        const card = await db.get(
            'SELECT data FROM cards WHERE uuid = ?',
            [uuid]
        );
        
        if (!card) return null;
        return JSON.parse(card.data);
    } catch (error) {
        console.error(`Failed to get card with UUID ${uuid}:`, error);
        return null;
    }
}

/**
 * Get cards by UUID
 */
export async function getCardsByUuid(uuids: string[]): Promise<any> {
    try {
        const db = await getCardDatabase();
        // Check if cards table exists
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master
            WHERE type='table' AND name='cards'`
        );

        if (!tableCheck) {
            console.warn("Cards table doesn't exist in the database");
            return [];
        }

        // Get all cards from the cards table
        const cards = await db.all(`SELECT * FROM cards WHERE uuid IN (${uuids.map(() => '?').join(',')})`, uuids);

        console.log(`Loaded card data for ${cards.length} cards`);
        
        // Get card identifiers and create a lookup map
        const cardIdentifiers = await db.all(`SELECT * FROM cardIdentifiers WHERE uuid IN (${uuids.map(() => '?').join(',')})`, uuids);
        const cardIdentifiersMap = cardIdentifiers.reduce((acc, row) => {
            acc[row.uuid] = row;
            return acc;
        }, {});
        
        // Initialize empty pricing map
        let pricingDataMap: Record<string, any> = {};
        
        // Try to load pricing data if available
        try {
            const pricingDb = await getPricingDatabase();
            
            // Check if the pricing database has the necessary table
            const pricingTableCheck = await pricingDb.get(
                `SELECT name FROM sqlite_master
                WHERE type='table' AND name='cardPrices'`
            );
            
            if (pricingTableCheck) {
                console.log('Loading pricing information...');
                // Get the latest pricing information for paper
                const prices = await pricingDb.all(
                    `SELECT * FROM cardPrices WHERE gameAvailability="paper" AND currency="USD" AND date = (SELECT MAX(date) FROM cardPrices) AND uuid IN (${uuids.map(() => '?').join(',')})`, uuids);
                
                // Create a simpler pricing data structure
                pricingDataMap = prices.reduce((acc, row) => {
                    if (!acc[row.uuid]) {
                        acc[row.uuid] = {};
                    }
                    
                    // Get the listing type (retail or buylist) and use as top level key
                    const listingType = row.providerListing?.toLowerCase() === 'buylist' ? 'buylist' : 'retail';
                    if (!acc[row.uuid][listingType]) {
                        acc[row.uuid][listingType] = {};
                    }
                    
                    // Use card finish as second level
                    const cardFinish = row.cardFinish?.toLowerCase() || 'normal';
                    if (acc[row.uuid][listingType][cardFinish] === undefined) {
                        acc[row.uuid][listingType][cardFinish] = {};
                    }
                    
                    // Store price provider and price directly
                    if (row.price) {
                        const priceProvider = row.priceProvider.toLowerCase();
                        acc[row.uuid][listingType][cardFinish][priceProvider] = row.price;
                    }
                    
                    return acc;
                }, {});
                
                console.log(`Loaded pricing data for ${Object.keys(pricingDataMap).length} cards`);
            } else {
                console.warn("Pricing table doesn't exist in the pricing database");
            }
        } catch (error) {
            console.warn('Failed to load pricing data:', error);
            // Continue without pricing data
        }
        
        // Combine all data and return the complete card list
        return cards.map((card) => {
            return {
                ...card,
                identifiers: cardIdentifiersMap[card.uuid] || null,
                pricing: pricingDataMap[card.uuid] || null
            } as CardSet;
        });
    } catch (error) {
        console.error('Error loading card list:', error);
        return [];
    }
}

/**
 * Search for cards by name
 */
export async function searchCardsByName(name: string, limit = 20) {
    try {
        const db = await getCardDatabase();
        const cards = await db.all(
            `SELECT data FROM cards 
             WHERE name LIKE ? 
             LIMIT ?`,
            [`%${name}%`, limit]
        );
        
        return cards.map(row => JSON.parse(row.data));
    } catch (error) {
        console.error(`Failed to search cards by name "${name}":`, error);
        return [];
    }
}

export async function loadSymbolData() {
    try {
        // Symbol data is typically small, so we can just read the file
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
 * Close database connections when the application is shutting down
 */
export async function closeConnections() {
    if (cardDb) {
        await cardDb.close();
        cardDb = null;
    }
    
    /* // Commented out pricing DB close
    if (priceDb) {
        await priceDb.close();
        priceDb = null;
    }
    */
    
    console.log('Database connections closed.');
}

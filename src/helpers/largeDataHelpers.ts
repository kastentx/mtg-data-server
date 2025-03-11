import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import CardDataStore from '../store/cardData';
import { AllPrintingsFile, Meta, SetList, CardSet } from '../types';

const DATA_DIR = 'data';
// Removed pricing-related DB variables
const CARD_DB_FILE = 'AllPrintings.sqlite';
const CARD_DB_PATH = path.join(DATA_DIR, CARD_DB_FILE);

// Database connection cache
let cardDb: Database | null = null;

/**
 * Gets or creates a connection to the card database
 */
export async function getCardDatabase(): Promise<Database> {
    if (!cardDb) {
        if (!existsSync(CARD_DB_PATH)) {
            throw new Error(`Card database not found at ${CARD_DB_PATH}. Please download it first.`);
        }
        
        console.log(`Opening SQLite database at ${CARD_DB_PATH}`);
        cardDb = await open({
            filename: CARD_DB_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });
        console.log('Database connection established');
    }
    return cardDb;
}

/**
 * Initialize the CardDataStore with data from the SQLite database
 */
export async function initializeCardStore(): Promise<boolean> {
    try {
        console.log('Initializing card data store from SQLite database...');
        const cardStore = CardDataStore.getInstance();
        const db = await getCardDatabase();
        
        // Load metadata
        console.log('Loading metadata...');
        const meta = await loadMetadata(db);
        
        // Get list of available sets
        console.log('Loading set information...');
        const sets = await loadSetList(db);
        
        // // Initialize card data structure with metadata
        // const cardData: AllPrintingsFile = { 
        //     meta: meta as Meta, 
        //     data: {} 
        // };
        const cards = await loadCardList(db);


        // Update card store
        // cardStore.setData(cardData);
        cardStore.setMetadata(meta);
        cardStore.setAvailableSets(sets);
        cardStore.setAvailableCards(cards);
        
        console.log(`Card store initialized with ${sets.length} available sets`);
        return true;
    } catch (error) {
        console.error('Failed to initialize card store:', error);
        return false;
    }
}

/**
 * Load metadata from the database
 */
async function loadMetadata(db: Database): Promise<any> {
    try {
        // Get metadata from meta table
        const metaRow = await db.get('SELECT date, version FROM meta LIMIT 1');
        if (metaRow) {
            try {
                return metaRow as Meta;
            } catch (e) {
                console.warn('Failed to parse card metadata:', e);
            }
        }
        return {};
    } catch (error) {
        console.error('Error loading metadata:', error);
        return {};
    }
}

/**
 * Load the list of all available sets from the database
 */
async function loadSetList(db: Database): Promise<SetList[]> {
    try {
        // Check if sets table exists
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master 
            WHERE type='table' AND name='sets'`
        );
        
        if (!tableCheck) {
            console.warn("Sets table doesn't exist in the database");
            return [];
        }
        
        // Get all sets from the sets table
        const sets = await db.all('SELECT * FROM sets');
        return sets as SetList[];
    } catch (error) {
        console.error('Error loading set list:', error);
        return [];
    }
}

async function loadCardList(db: Database): Promise<CardSet[]> {
    try {
        // Check if cards table exists
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master
            WHERE type='table' AND name='cards'`
        );

        if (!tableCheck) {
            console.warn("Cards table doesn't exist in the database");
            return [];
        }

        // Get all cards from the cards table and join with the cardIdentifiers table
        const cards = await db.all('SELECT * FROM cards');
        const cardIdentifiers = await db.all('SELECT * FROM cardIdentifiers');
        const cardIdentifiersMap = cardIdentifiers.reduce((acc, row) => {
            acc[row.uuid] = row;
            return acc;
        }, {});
        
        return cards.map((card) => {
            const identifiers = cardIdentifiersMap[card.uuid];
            return {
                ...card,
                identifiers: identifiers
            } as CardSet;
        });
    } catch (error) {
        console.error('Error loading card list:', error);
        return [];
    }
}


/**
 * Get data for a specific set by its code
 */
// export async function getSetData(setCode: string): Promise<any> {
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
export async function getCardByUuid(uuid: string): Promise<any> {
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
 * Search for cards by name
 */
export async function searchCardsByName(name: string, limit = 20): Promise<any[]> {
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

/**
 * Close database connections when the application is shutting down
 */
export async function closeConnections(): Promise<void> {
    if (cardDb) {
        await cardDb.close();
        cardDb = null;
        console.log('Database connections closed.');
    }
}

// Commented out all pricing-related functions
/*
// Alternative approach: Use SQLite as a more efficient storage solution for large JSON data
export async function setupDatabase() {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Open SQLite database
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
    
    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS card_sets (
            code TEXT PRIMARY KEY,
            name TEXT,
            data TEXT
        );
        
        CREATE TABLE IF NOT EXISTS card_prices (
            uuid TEXT PRIMARY KEY,
            data TEXT
        );
        
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
    
    return db;
}

// Process pricing data with SQLite for better memory efficiency
export async function processPricingDataWithDb(pricingPath: string) {
    // ... existing pricing processing code ...
}

// Retrieve pricing data from the database
export async function getPricingFromDb(uuid: string) {
    // ... existing pricing retrieval code ...
}

// Process card data with chunked approach for better memory efficiency
export async function processCardDataInChunks(cardDataPath: string, outputDir: string) {
    // ... existing chunk processing code ...
}
*/

import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import CardDataStore from '../store/cardData';
import { AllPrintingsFile, Meta, SetList, CardSet } from '../types';

const DATA_DIR = 'data';
// Added pricing DB file reference
const CARD_DB_FILE = 'AllPrintings.sqlite';
const PRICING_DB_FILE = 'AllPricesToday.sqlite';
const CARD_DB_PATH = path.join(DATA_DIR, CARD_DB_FILE);
const PRICING_DB_PATH = path.join(DATA_DIR, PRICING_DB_FILE);

// Database connection cache
let cardDb: Database | null = null;
let pricingDb: Database | null = null;

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
 * Gets or creates a connection to the pricing database
 */
export async function getPricingDatabase(): Promise<Database> {
    if (!pricingDb) {
        if (!existsSync(PRICING_DB_PATH)) {
            throw new Error(`Pricing database not found at ${PRICING_DB_PATH}. Please download it first.`);
        }
        
        console.log(`Opening pricing SQLite database at ${PRICING_DB_PATH}`);
        pricingDb = await open({
            filename: PRICING_DB_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });
        console.log('Pricing database connection established');
    }
    return pricingDb;
}

/**
 * Initialize the CardDataStore with data from the SQLite database
 */
export async function initializeCardStore(): Promise<boolean> {
    try {
        console.log('Initializing card data store from SQLite database...');
        const cardStore = CardDataStore.getInstance();
        const db = await getCardDatabase();
        
        // Also initialize pricing database connection
        try {
            await getPricingDatabase();
            console.log('Pricing database initialized');
        } catch (error) {
            console.warn('Failed to initialize pricing database:', error);
            // Continue without pricing data if unavailable
        }
        
        // Load metadata
        console.log('Loading metadata...');
        const meta = await loadMetadata(db);
        
        // Get list of available sets
        console.log('Loading set information...');
        const sets = await loadSetList(db);
        
        console.log('Loading card information...');
        const cards = await loadCardList(db);

        // Update card store
        cardStore.setMetadata(meta);
        cardStore.setAvailableSets(sets);
        cardStore.setAvailableCards(cards);
        
        console.log(`Card store initialized with ${sets.length} available sets and ${cards.length} cards`);
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

        // Get all cards from the cards table
        const cards = await db.all('SELECT * FROM cards');
        
        // Get card identifiers and create a lookup map
        const cardIdentifiers = await db.all('SELECT * FROM cardIdentifiers');
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
                    'SELECT * FROM cardPrices WHERE gameAvailability="paper" AND currency="USD" AND date = (SELECT MAX(date) FROM cardPrices)'
                );
                
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
        console.log('Card database connection closed.');
    }
    
    if (pricingDb) {
        await pricingDb.close();
        pricingDb = null;
        console.log('Pricing database connection closed.');
    }
    
    console.log('All database connections closed.');
}

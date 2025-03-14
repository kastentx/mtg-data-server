import { Meta, SetList, CardSet } from '../types';
import { 
  getCardsByUuid, 
  searchCardsByName 
} from '../database/db';

/**
 * Singleton class to store and access MTG card data
 */
class CardDataStore {
  private static instance: CardDataStore;
  private metadata: Meta | null = null;
  private availableSets: SetList[] = [];
  private availableCards: CardSet[] = [];
  private symbols: any[] = [];

  private constructor() {}

  public static getInstance(): CardDataStore {
    if (!CardDataStore.instance) {
      CardDataStore.instance = new CardDataStore();
    }
    return CardDataStore.instance;
  }

  public setMetadata(meta: Meta): void {
    this.metadata = meta;
  }

  public getMetadata(): any {
    return this.metadata;
  }

  public setAvailableSets(sets: SetList[]): void {
    this.availableSets = sets;
  }

  public setAvailableCards(cards: CardSet[]): void {
    this.availableCards = cards;
  }

  public setSymbols(symbols: any[]): void {
    this.symbols = symbols;
  }

  public getSymbols(): any[] {
    return this.symbols;
  }

  public getAvailableSets(exclude_online_only: boolean = true): SetList[] {
    if (exclude_online_only) {
      return this.availableSets.filter((set) => !set.isOnlineOnly);
    }
    return this.availableSets;
  }

  public getSetbyCode(code: string): SetList | undefined {
    return this.availableSets.find((set) => set.code === code);
  }

  public getCardsBySetCode(code: string): CardSet[] {
    return this.availableCards.filter((card) => card.setCode === code);
  }

  /**
   * Gets a card by UUID using SQLite database
   */
  public async getCardsByUuid(uuids: string[]): Promise<CardSet[]> {
    return await getCardsByUuid(uuids);
  }

  /**
   * Searches for cards by name using SQLite database
   */
  public async searchCards(name: string, limit = 20): Promise<CardSet[]> {
    return await searchCardsByName(name, limit);
  }
}

export default CardDataStore;

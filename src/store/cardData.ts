interface CardData {
    meta?: any;
    data?: any;
    [key: string]: any;
}

class CardDataStore {
    private static instance: CardDataStore;
    private data: CardData = {};

    private constructor() {}

    static getInstance(): CardDataStore {
        if (!CardDataStore.instance) {
            CardDataStore.instance = new CardDataStore();
        }
        return CardDataStore.instance;
    }

    setData(data: CardData) {
        this.data = data;
    }

    getData(): CardData {
        return this.data;
    }
}

export default CardDataStore;

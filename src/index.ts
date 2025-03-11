import express from 'express';
import cors from 'cors';
import { engine } from 'express-handlebars';
import path from 'path';
import adminRouter from './routes/adminRouter';
import setsRouter from './routes/setsRouter';
import { 
  downloadSymbolData,
  loadSymbolData 
} from './helpers/mtgJsonHelpers';
import {
  initializeCardStore,
  closeConnections
} from './helpers/largeDataHelpers';
import cardsRouter from './routes/cardsRouter';

const app = express();
const port = process.env.PORT || 3000;

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'MTG Data Server is running' });
});

app.use('/admin', adminRouter);
app.use('/api/v1/sets', setsRouter);
app.use('/api/v1/cards', cardsRouter);

async function initializeData() {
  try {
    console.log('Initializing data...');
    
    // Download and load symbol data (this is still small JSON)
    await downloadSymbolData();
    await loadSymbolData();
    
    // Initialize card store from existing SQLite database
    await initializeCardStore();

    console.log('Data loaded successfully!');
  } catch (error) {
    console.error('Failed to initialize data:', error);
    process.exit(1);
  }
}

app.listen(port, async () => {
  console.log(`Server started on port ${port}`);
  await initializeData();
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await closeConnections();
  process.exit(0);
});

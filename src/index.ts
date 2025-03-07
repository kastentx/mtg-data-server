import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'MTG Data Server is running' });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

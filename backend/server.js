const express = require('express');
const cors = require('cors');
const path = require('path');
const { Crossword } = require('./generation');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Раздача фронтенда
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/generate', (req, res) => {
    const count = parseInt(req.query.count) || 30;
    const seed = req.query.seed || 'кроссворд';

    const firstWord = {
        word: seed,
        x: 0,
        y: 0,
        direction: 'horizontal'
    };

    const crossword = new Crossword(firstWord);
    crossword.generate(count);

    res.json(crossword.toJSON());
});

app.listen(PORT, () => {
    console.log(`Crossword server running on http://localhost:${PORT}`);
});

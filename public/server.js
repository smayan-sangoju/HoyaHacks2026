const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', () => console.log(`Frontend running on http://127.0.0.1:${PORT}`));

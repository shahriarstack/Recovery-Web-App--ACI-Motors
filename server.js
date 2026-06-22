const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
